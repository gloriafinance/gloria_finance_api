import { promises as fs } from "node:fs"
import {
  Controller,
  Get,
  Query,
  Req,
  Res,
  Use,
  type ServerResponse,
} from "bun-platform-kit"
import domainResponse from "@/Shared/helpers/domainResponse.ts"
import type { AuthenticatedRequest } from "@/Shared/infrastructure"
import { Can, NoOpStorage, PermissionMiddleware } from "@/Shared/infrastructure"
import { HttpStatus } from "@/Shared/domain"
import {
  CashFlow,
  CashFlowBucketDetails,
  GenerateCashFlowReportExport,
} from "@/Reports/applications"
import { CashFlowMongoRepository } from "@/Reports/infrastructure/persistence/CashFlowMongoRepository.ts"
import {
  mapCashFlowBucketDetailsToResponse,
  mapCashFlowReportToResponse,
} from "@/Reports/infrastructure/http/mappers/CashFlowResponse.mapper.ts"
import type {
  CashFlowBucketDetailsFilters,
  CashFlowExportRequest,
  CashFlowFilters,
} from "@/Reports/domain"
import {
  CashFlowBucketDetailsValidator,
  CashFlowExportQueryValidator,
  CashFlowQueryValidator,
} from "@/Reports/infrastructure/http/validators/CashFlowQuery.validator.ts"
import { ChurchMongoRepository } from "@/Church/infrastructure/persistence/ChurchMongoRepository.ts"
import { HandlebarsHTMLAdapter } from "@/Shared/adapter/HandlebarsHTML.adapter.ts"
import { PuppeteerAdapter } from "@/Shared/adapter/GeneratePDF.adapter.ts"
import { XLSExportAdapter } from "@/Shared/adapter/XLSExportAdapter.ts"

@Controller("/api/v1/reports/cash-flow")
export class CashFlowController {
  @Get("/")
  @Use([
    PermissionMiddleware,
    Can("financial_records", "reports"),
    CashFlowQueryValidator,
  ])
  async report(
    @Query() query: CashFlowFilters,
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    try {
      const filters = this.withChurch(query, req.auth.churchId)
      const data = await new CashFlow(
        CashFlowMongoRepository.getInstance()
      ).execute(filters)

      res
        .status(HttpStatus.OK)
        .send(mapCashFlowReportToResponse(data, filters, new Date()))
    } catch (e) {
      domainResponse(e, res)
    }
  }

  @Get("/details")
  @Use([
    PermissionMiddleware,
    Can("financial_records", "reports"),
    CashFlowBucketDetailsValidator,
  ])
  async details(
    @Query() query: CashFlowBucketDetailsFilters,
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    try {
      const filters = this.withChurch(query, req.auth.churchId)
      const data = await new CashFlowBucketDetails(
        CashFlowMongoRepository.getInstance()
      ).execute(filters)

      res.status(HttpStatus.OK).send(mapCashFlowBucketDetailsToResponse(data))
    } catch (e) {
      domainResponse(e, res)
    }
  }

  @Get("/export")
  @Use([
    PermissionMiddleware,
    Can("financial_records", "reports"),
    CashFlowExportQueryValidator,
  ])
  async export(
    @Query() query: Omit<CashFlowExportRequest, "lang">,
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    try {
      const file = await new GenerateCashFlowReportExport(
        ChurchMongoRepository.getInstance(),
        CashFlowMongoRepository.getInstance(),
        new PuppeteerAdapter(
          new HandlebarsHTMLAdapter(),
          NoOpStorage.getInstance()
        ),
        new XLSExportAdapter()
      ).execute({
        ...this.withChurch(query, req.auth.churchId),
        format: query.format,
        lang: req.auth.lang,
      })

      res.download!(file.path, file.filename, (error) => {
        fs.unlink(file.path).catch(() => undefined)

        if (error) {
          domainResponse(error, res)
        }
      })
    } catch (e) {
      domainResponse(e, res)
    }
  }

  private withChurch<T extends CashFlowFilters | CashFlowBucketDetailsFilters>(
    query: T,
    churchId: string
  ): T {
    return {
      ...query,
      churchId,
    }
  }
}
