import { GenericException, HttpStatus } from "@/Shared/domain"
import domainResponse from "@/Shared/helpers/domainResponse"
import type {
  FilterFinanceRecordRequest,
  FinanceRecordReportFormat,
  FinanceRecordReportRequest,
  FinancialRecordCreateQueue,
  FinancialRecordRequest,
} from "../../../domain"
import {
  AccountType,
  ConceptType,
  CostCenter,
  FinancialConcept,
  FinancialRecordSource,
  FinancialRecordStatus,
} from "../../../domain"
import {
  CancelFinancialRecord,
  FetchingFinanceRecord,
  GenerateFinanceRecordReport,
} from "@/Financial/applications"
import type { AuthenticatedRequest } from "@/Shared/infrastructure"
import {
  Can,
  NoOpStorage,
  PermissionMiddleware,
  QueueService,
  StorageGCP,
} from "@/Shared/infrastructure"
import { FinancialYearMongoRepository } from "@/ConsolidatedFinancial/infrastructure"
import {
  AvailabilityAccountMongoRepository,
  FinanceRecordMongoRepository,
} from "../../persistence"
import { CreateFinancialRecordJob } from "@/Financial/applications/jobs/CreateFinancialRecord.job"
import { toFinancialRecordType } from "@/Financial/domain/mappers"
import {
  FindAvailabilityAccountByAvailabilityAccountId,
  FindCostCenterByCostCenterId,
  FindFinancialConceptByChurchIdAndFinancialConceptId,
} from "@/FinanceConfig/applications"
import {
  FinancialConceptMongoRepository,
  FinancialConfigurationMongoRepository,
} from "@/FinanceConfig/infrastructure/presistence"
import type { ServerResponse } from "bun-platform-kit"
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  Use,
} from "bun-platform-kit"
import FinancialRecordValidator from "@/Financial/infrastructure/http/validators/FinancialRecord.validator"
import FinanceRecordPaginateDTO from "@/Financial/infrastructure/http/dto/FinanceRecordPaginate.dto"
import { ChurchMongoRepository } from "@/Church/infrastructure"
import {
  HandlebarsHTMLAdapter,
  Logger,
  PuppeteerAdapter,
  XLSExportAdapter,
} from "@/Shared/adapter"
import { promises as fs } from "node:fs"

const DEFAULT_PAGE = 1
const DEFAULT_PER_PAGE = 1000

const sanitizeFormat = (
  format?: string
): FinanceRecordReportFormat | undefined => {
  if (!format) {
    return undefined
  }

  const normalized = format.toLowerCase()

  if (normalized === "pdf") {
    return "pdf"
  }

  return "csv"
}

@Controller("/api/v1/finance/financial-record")
export class FinancialRecordController {
  private logger = Logger(FinancialRecordController.name)

  @Post("/")
  @Use([
    PermissionMiddleware,
    Can("financial_records", "create"),
    FinancialRecordValidator,
  ])
  async financialRecordController(
    @Body() body: FinancialRecordRequest & { createdBy: string },
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    const request = {
      ...body,
      churchId: req.auth.churchId,
      file: req?.files?.file,
    }
    try {
      const financialConcept =
        await new FindFinancialConceptByChurchIdAndFinancialConceptId(
          FinancialConceptMongoRepository.getInstance()
        ).execute(request.churchId, request.financialConceptId)

      const availabilityAccount = await this.searchAvailabilityAccount(
        request,
        financialConcept
      )

      let costCenter: CostCenter = undefined

      if (
        financialConcept.getType() === ConceptType.OUTGO &&
        !request.costCenterId
      ) {
        //TODO message em portugues, should be internationalized
        res.status(HttpStatus.BAD_REQUEST).send({
          costCenterId: {
            message: "Deve selecionar um centro de custos.",
            rule: "required",
          },
        })
        return
      }
      if (
        financialConcept.getType() === ConceptType.OUTGO &&
        request.costCenterId
      ) {
        costCenter = await new FindCostCenterByCostCenterId(
          FinancialConfigurationMongoRepository.getInstance()
        ).execute(request.churchId, request.costCenterId)
      }

      await new CreateFinancialRecordJob(
        FinancialYearMongoRepository.getInstance(),
        FinanceRecordMongoRepository.getInstance(),
        StorageGCP.getInstance(process.env.BUCKET_FILES),
        QueueService.getInstance()
      ).handle({
        ...request,
        costCenter,
        financialConcept,
        financialRecordType: toFinancialRecordType(financialConcept.getType()),
        availabilityAccount,
        status: FinancialRecordStatus.CLEARED,
        source: FinancialRecordSource.MANUAL,
      } as FinancialRecordCreateQueue)

      res.status(HttpStatus.CREATED).send({
        message: "successful financial record registration",
      })
    } catch (e) {
      if (request.voucher) {
        await StorageGCP.getInstance(process.env.BUCKET_FILES).deleteFile(
          request.voucher
        )
      }

      return domainResponse(e, res)
    }
  }

  @Patch("/cancel/:financialRecordId")
  @Use([PermissionMiddleware, Can("financial_records", "cancel")])
  async CancelFinancialRecordController(
    @Param("financialRecordId") financialRecordId: string,
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    try {
      await new CancelFinancialRecord(
        FinancialYearMongoRepository.getInstance(),
        FinanceRecordMongoRepository.getInstance(),
        AvailabilityAccountMongoRepository.getInstance(),
        QueueService.getInstance()
      ).execute({
        financialRecordId: financialRecordId,
        churchId: req.auth.churchId,
        createdBy: req.auth.name,
      })

      res.status(HttpStatus.OK).send({
        message: "successful financial record cancellation",
      })
    } catch (e) {
      domainResponse(e, res)
    }
  }

  @Get("/export")
  @Use([PermissionMiddleware, Can("financial_records", "reports")])
  async export(
    @Query() params: FinanceRecordReportRequest,
    @Res() res: ServerResponse,
    @Req() req: AuthenticatedRequest
  ) {
    try {
      const normalizedRequest: FinanceRecordReportRequest = {
        ...params,
        churchId: req.auth.churchId,
        format: sanitizeFormat(params.format),
        page: params.page ?? DEFAULT_PAGE,
        perPage: params.perPage ?? DEFAULT_PER_PAGE,
      }

      this.logger.info("Processando solicitação de relatório financeiro", {
        ...normalizedRequest,
        format: normalizedRequest.format ?? "csv",
      })

      const file = await new GenerateFinanceRecordReport(
        ChurchMongoRepository.getInstance(),
        FinanceRecordMongoRepository.getInstance(),
        new PuppeteerAdapter(
          new HandlebarsHTMLAdapter(),
          NoOpStorage.getInstance()
        ),
        new XLSExportAdapter()
      ).execute(normalizedRequest)

      const { path, filename } = file

      res.download(path, filename, (error) => {
        fs.unlink(path).catch(() => undefined)

        //if (error && !res.headersSent) {
        if (error) {
          console.log(error)
          domainResponse(error, res)
        }
      })

      this.logger.info("Relatório financeiro gerado com sucesso")
    } catch (error) {
      this.logger.error("Erro ao gerar relatório financeiro", error)
      domainResponse(error, res)
    }
  }

  @Get("/")
  @Use([PermissionMiddleware, Can("financial_records", "read")])
  async fetching(
    @Param() params: FilterFinanceRecordRequest,
    @Query() q: FilterFinanceRecordRequest,
    @Res() res: ServerResponse,
    @Req() req: AuthenticatedRequest
  ) {
    try {
      const filter = { ...q, churchId: req.auth.churchId }
      this.logger.info(
        `Filtering financial records with: ${JSON.stringify(filter)}`
      )
      const list = await new FetchingFinanceRecord(
        FinanceRecordMongoRepository.getInstance()
      ).execute(filter)

      res.status(HttpStatus.OK).send(await FinanceRecordPaginateDTO(list))
    } catch (e) {
      return domainResponse(e, res)
    }
  }

  private async searchAvailabilityAccount(
    request: FinancialRecordRequest,
    financialConcept: FinancialConcept
  ) {
    const account = await new FindAvailabilityAccountByAvailabilityAccountId(
      AvailabilityAccountMongoRepository.getInstance()
    ).execute(request.availabilityAccountId)

    if (account.getType() === AccountType.INVESTMENT) {
      throw new GenericException(
        `Selected availability account does not allow this ${financialConcept.getName()}`
      )
    }

    return account
  }
}
