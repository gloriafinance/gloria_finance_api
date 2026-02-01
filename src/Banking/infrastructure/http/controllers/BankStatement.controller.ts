import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Req,
  Res,
  Use,
  type ServerResponse,
} from "bun-platform-kit"
import { GenericException, HttpStatus, IQueueService } from "@/Shared/domain"
import domainResponse from "@/Shared/helpers/domainResponse"
import {
  ImportBankStatement,
  LinkBankStatementToFinancialRecord,
  ListBankStatements,
  RetryBankStatementReconciliation,
} from "@/Banking/applications"
import {
  BankMongoRepository,
  BankStatementMongoRepository,
} from "@/Banking/infrastructure/persistence"
import { BankStatementReconciler } from "@/Banking/applications/BankStatementReconciler"
import {
  Can,
  PermissionMiddleware,
  QueueService,
} from "@/Shared/infrastructure"
import type { AuthenticatedRequest } from "@/Shared/infrastructure"
import {
  AvailabilityAccountMongoRepository,
  FinanceRecordMongoRepository,
} from "@/Financial/infrastructure/persistence"
import {
  Bank,
  type ImportBankStatementRequest,
  type ListBankStatementsRequest,
} from "@/Banking/domain"
import { BankStatementParserFactory } from "@/Banking/infrastructure/parsers/BankStatementParserFactory"
import { ImportBankStatementValidator } from "../validators/ImportBankStatement.validator"
import { LinkBankStatementValidator } from "../validators/LinkBankStatement.validator"

type ImportBankStatementPayload = Omit<
  ImportBankStatementRequest,
  "file" | "uploadedBy" | "churchId"
>

@Controller("/api/v1/bank/statements")
export class BankStatementController {
  @Get("/")
  @Use([
    PermissionMiddleware,
    Can("banking", ["statements", "read_statements"]),
  ])
  async list(
    @Query() params: ListBankStatementsRequest,
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ): Promise<void> {
    try {
      const repository = BankStatementMongoRepository.getInstance()
      const result = await new ListBankStatements(repository).execute({
        ...params,
        churchId: req.auth.churchId,
      })

      res.status(HttpStatus.OK).send(result)
    } catch (error) {
      domainResponse(error, res)
    }
  }

  @Post("/import")
  @Use([
    PermissionMiddleware,
    Can("banking", "statements"),
    ImportBankStatementValidator,
  ])
  async importStatement(
    @Body() body: ImportBankStatementPayload,
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ): Promise<void> {
    try {
      const file = req.files?.file

      if (!file) {
        res.status(HttpStatus.BAD_REQUEST).send({
          file: {
            message: "Arquivo do extrato é obrigatório",
            rule: "required",
          },
        })
        return
      }

      const bank = await this.resolveBankForParsing(body.bankId)

      const result = await new ImportBankStatement(
        AvailabilityAccountMongoRepository.getInstance(),
        QueueService.getInstance()
      ).execute({
        bank,
        ...body,
        file,
        uploadedBy: req.auth.name,
        churchId: req.auth.churchId,
      })

      res.status(HttpStatus.ACCEPTED).send({
        bank: bank.getBankName(),
        queuedAt: result.queuedAt,
      })
    } catch (error) {
      domainResponse(error, res)
    }
  }

  @Post("/:bankStatementId/retry")
  @Use([PermissionMiddleware, Can("banking", "statements")])
  async retryReconciliation(
    @Param("bankStatementId") bankStatementId: string,
    @Body() body: { churchId?: string },
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ): Promise<void> {
    try {
      if (!bankStatementId) {
        res.status(HttpStatus.BAD_REQUEST).send({
          bankStatementId: {
            message: "Identificador do extrato é obrigatório",
            rule: "required",
          },
        })
        return
      }

      const churchId =
        req.auth.isSuperuser && body?.churchId
          ? body.churchId
          : req.auth.churchId
      const repository = BankStatementMongoRepository.getInstance()
      const reconciler = this.buildReconciler(QueueService.getInstance())

      const result = await new RetryBankStatementReconciliation(
        repository,
        reconciler
      ).execute({
        bankStatementId,
        churchId,
      })

      res.status(HttpStatus.OK).send(result)
    } catch (error) {
      domainResponse(error, res)
    }
  }

  @Patch("/:bankStatementId/link")
  @Use([
    PermissionMiddleware,
    Can("banking", "statements"),
    LinkBankStatementValidator,
  ])
  async linkFinancialRecord(
    @Param("bankStatementId") bankStatementId: string,
    @Body() body: { financialRecordId?: string },
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ): Promise<void> {
    try {
      if (!bankStatementId) {
        res.status(HttpStatus.BAD_REQUEST).send({
          bankStatementId: {
            message: "Identificador do extrato é obrigatório",
            rule: "required",
          },
        })
        return
      }

      const queueService = QueueService.getInstance()
      const bankRepo = BankStatementMongoRepository.getInstance()
      const financialRecordRepository =
        FinanceRecordMongoRepository.getInstance()

      await new LinkBankStatementToFinancialRecord(
        bankRepo,
        financialRecordRepository,
        queueService
      ).execute({
        bankStatementId,
        financialRecordId: body.financialRecordId,
        churchId: req.auth.churchId,
      })

      res.status(HttpStatus.OK).send({
        reconciled: true,
        bankStatementId,
        financialRecordId: body.financialRecordId,
      })
    } catch (error) {
      domainResponse(error, res)
    }
  }

  private buildReconciler(queueService: IQueueService) {
    return new BankStatementReconciler(
      BankStatementMongoRepository.getInstance(),
      FinanceRecordMongoRepository.getInstance(),
      queueService
    )
  }

  private async resolveBankForParsing(bankId: string): Promise<Bank> {
    const parserFactory = BankStatementParserFactory.getInstance()
    const bank = await BankMongoRepository.getInstance().findById(bankId)

    const canResolve = (bankName: string): boolean => {
      try {
        parserFactory.resolve(bankName)
        return true
      } catch {
        return false
      }
    }

    if (!canResolve(bank.getBankName())) {
      throw new GenericException(
        `Banco ${bank.getBankName()} não possui parser configurado`
      )
    }

    return bank
  }
}
