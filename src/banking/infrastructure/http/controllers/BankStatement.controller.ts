import { Response } from "express"
import { HttpStatus } from "@/Shared/domain"
import domainResponse from "@/Shared/helpers/domainResponse"
import {
  ImportBankStatement,
  ListBankStatements,
  RetryBankStatementReconciliation,
  LinkBankStatementToFinancialRecord,
} from "@/banking/applications"
import {
  BankStatementMongoRepository,
} from "@/banking/infrastructure/persistence"
import { BankStatementReconciler } from "@/banking/infrastructure/services/BankStatementReconciler"
import { QueueService } from "@/Shared/infrastructure"
import { FinanceRecordMongoRepository } from "@/Financial/infrastructure/persistence"
import { BankStatementStatus } from "@/banking/domain"
import { IQueueService } from "@/Shared/domain"

type ImportBankStatementHttpRequest = {
  bank: string
  month: number | string
  year: number | string
  accountName?: string
  churchId?: string
  files?: Record<string, any>
  user: {
    churchId: string
    name: string
    isSuperuser?: boolean
  }
}

export const importBankStatementController = async (
  req: ImportBankStatementHttpRequest,
  res: Response
): Promise<void> => {
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

    const bank = String(req.bank).toUpperCase()
    const month = Number(req.month)
    const year = Number(req.year)
    const churchId = resolveChurchId(req)

    if (Number.isNaN(month) || Number.isNaN(year)) {
      res.status(HttpStatus.UNPROCESSABLE_ENTITY).send({
        month: {
          message: "Mês e ano devem ser numéricos",
          rule: "integer",
        },
      })
      return
    }

    const result = await new ImportBankStatement(
      QueueService.getInstance()
    ).execute({
      bank,
      churchId,
      month,
      year,
      accountName: req.accountName,
      uploadedBy: req.user.name,
      file,
    })

    res.status(HttpStatus.ACCEPTED).send({
      bank,
      month,
      year,
      churchId,
      queuedAt: result.queuedAt,
    })
  } catch (error) {
    domainResponse(error, res)
  }
}

type ListBankStatementsHttpRequest = {
  query: Record<string, any>
  user: {
    churchId: string
    isSuperuser?: boolean
  }
}

export const listBankStatementsController = async (
  req: ListBankStatementsHttpRequest,
  res: Response
): Promise<void> => {
  try {
    const { query } = req
    const churchId = resolveChurchId({
      user: req.user,
      churchId: query.churchId as string,
    } as any)

    const statusValue = query.status
      ? String(query.status).toUpperCase()
      : undefined

    const status = statusValue && Object.values(BankStatementStatus).includes(statusValue as BankStatementStatus)
      ? (statusValue as BankStatementStatus)
      : undefined
    const bank = query.bank ? String(query.bank).toUpperCase() : undefined
    const monthValue = query.month ? Number(query.month) : undefined
    const yearValue = query.year ? Number(query.year) : undefined
    const month = monthValue !== undefined && !Number.isNaN(monthValue) ? monthValue : undefined
    const year = yearValue !== undefined && !Number.isNaN(yearValue) ? yearValue : undefined
    const dateFrom = parseDate(query.dateFrom)
    const dateTo = parseDate(query.dateTo)

    const repository = BankStatementMongoRepository.getInstance()
    const statements = await new ListBankStatements(repository).execute({
      churchId,
      bank,
      status,
      month,
      year,
      dateFrom,
      dateTo,
    })

    res.status(HttpStatus.OK).send(
      statements.map((statement) => mapToResponse(statement))
    )
  } catch (error) {
    domainResponse(error, res)
  }
}

type RetryBankStatementHttpRequest = {
  params: { bankStatementId: string }
  user: { churchId: string; isSuperuser?: boolean }
  body?: { churchId?: string }
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

    const churchId = req.user.isSuperuser && req.body?.churchId
      ? req.body.churchId
      : req.user.churchId
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

type LinkBankStatementHttpRequest = {
  params: { bankStatementId: string }
  body: { financialRecordId: string }
  user: { churchId: string }
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
      churchId: req.user.churchId,
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

const resolveChurchId = (req: { user: { churchId: string; isSuperuser?: boolean }; churchId?: string }): string => {
  if (req.user?.isSuperuser && req.churchId) {
    return req.churchId
  }

  return req.user?.churchId
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
    reconciledAt: primitive.reconciledAt?.toISOString?.() ?? primitive.reconciledAt,
  }
}

const parseDate = (value: unknown): Date | undefined => {
  if (!value) {
    return undefined
  }

  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? undefined : date
}
