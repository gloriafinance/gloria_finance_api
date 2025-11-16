import { Response } from "express"
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
import { QueueService } from "@/Shared/infrastructure"
import {
  AvailabilityAccountMongoRepository,
  FinanceRecordMongoRepository,
} from "@/Financial/infrastructure/persistence"
import {
  Bank,
  ImportBankStatementRequest,
  LinkBankStatementHttpRequest,
  ListBankStatementsRequest,
  RetryBankStatementHttpRequest,
} from "@/Banking/domain"
import { BankStatementParserFactory } from "@/Banking/infrastructure/parsers/BankStatementParserFactory"

export const importBankStatementController = async (
  req: ImportBankStatementRequest,
  res: Response
): Promise<void> => {
  try {
    const bank = await resolveBankForParsing(req.bankId)

    const result = await new ImportBankStatement(
      AvailabilityAccountMongoRepository.getInstance(),
      QueueService.getInstance()
    ).execute({
      bank,
      ...req,
    })

    res.status(HttpStatus.ACCEPTED).send({
      bank: bank.getBankName(),
      queuedAt: result.queuedAt,
    })
  } catch (error) {
    domainResponse(error, res)
  }
}

export const listBankStatementsController = async (
  req: ListBankStatementsRequest,
  res: Response
): Promise<void> => {
  try {
    const repository = BankStatementMongoRepository.getInstance()
    const result = await new ListBankStatements(repository).execute(req)

    res.status(HttpStatus.OK).send(result)
  } catch (error) {
    domainResponse(error, res)
  }
}

export const retryBankStatementController = async (
  req: RetryBankStatementHttpRequest,
  res: Response
): Promise<void> => {
  try {
    const bankStatementId = req.params.bankStatementId

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
      req.auth.isSuperuser && req.body?.churchId
        ? req.body.churchId
        : req.auth.churchId
    const repository = BankStatementMongoRepository.getInstance()
    const reconciler = buildReconciler(QueueService.getInstance())

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

export const linkBankStatementController = async (
  req: LinkBankStatementHttpRequest,
  res: Response
): Promise<void> => {
  try {
    const bankStatementId = req.params.bankStatementId
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
    const financialRecordRepository = FinanceRecordMongoRepository.getInstance()

    await new LinkBankStatementToFinancialRecord(
      bankRepo,
      financialRecordRepository,
      queueService
    ).execute({
      bankStatementId,
      financialRecordId: req.body.financialRecordId,
      churchId: req.auth.churchId,
    })

    res.status(HttpStatus.OK).send({
      reconciled: true,
      bankStatementId,
      financialRecordId: req.body.financialRecordId,
    })
  } catch (error) {
    domainResponse(error, res)
  }
}

const buildReconciler = (queueService: IQueueService) =>
  new BankStatementReconciler(
    BankStatementMongoRepository.getInstance(),
    FinanceRecordMongoRepository.getInstance(),
    queueService
  )

const mapToResponse = (statement) => {
  const primitive = statement.toPrimitives()
  return {
    ...primitive,
    postedAt: primitive.postedAt?.toISOString?.() ?? primitive.postedAt,
    createdAt: primitive.createdAt?.toISOString?.() ?? primitive.createdAt,
    updatedAt: primitive.updatedAt?.toISOString?.() ?? primitive.updatedAt,
    reconciledAt:
      primitive.reconciledAt?.toISOString?.() ?? primitive.reconciledAt,
  }
}

const parseDate = (value: unknown): Date | undefined => {
  if (!value) {
    return undefined
  }

  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? undefined : date
}

const resolveBankForParsing = async (bankId: string): Promise<Bank> => {
  const parserFactory = BankStatementParserFactory.getInstance()
  const bank = await BankMongoRepository.getInstance().one(bankId)

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
