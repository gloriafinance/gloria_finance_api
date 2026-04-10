import { Logger } from "@/Shared/adapter/CustomLogger"

import {
  Bank,
  BankStatement,
  type IBankStatementRepository,
  type IntermediateBankStatement,
} from "@/Banking/domain"
import { BankStatementParserFactory } from "@/Banking/infrastructure/parsers"
import { BankStatementReconciler } from "@/Banking/applications"
import {
  type IJob,
  type IQueueService,
  QueueName,
} from "@/package/queue/domain"

type ImportBankStatementJobPayload = {
  churchId: string
  bank: any
  availabilityAccount: {
    accountName: string
    availabilityAccountId: string
  }
  month: number
  year: number
  fileContent: string
  uploadedBy: string
}

export class ImportBankStatementJob implements IJob {
  private readonly logger = Logger(ImportBankStatementJob.name)

  constructor(
    private readonly parserFactory: BankStatementParserFactory,
    private readonly bankStatementRepository: IBankStatementRepository,
    private readonly reconciler: BankStatementReconciler,
    private readonly queueService: IQueueService
  ) {}

  async handle(payload: ImportBankStatementJobPayload): Promise<void> {
    this.logger.info("Starting bank statement import job", payload)

    const bank = Bank.fromPrimitives(payload.bank)

    if (!payload.fileContent) {
      throw new Error("ImportBankStatementJob requires CSV file content")
    }

    const parser = this.parserFactory.resolve(bank.getBankName())

    const intermediates = await parser.parse({
      bank,
      availabilityAccount: payload.availabilityAccount,
      fileContent: payload.fileContent,
      month: payload.month,
      year: payload.year,
    })

    const { inserted, duplicates } =
      await this.persistNewStatements(intermediates)

    const reconciliationResult = await this.reconcileStatements(inserted)

    await this.notifyResult({
      payload,
      accountName: bank.getTag(),
      bankName: bank.getBankName(),
      total: intermediates.length,
      inserted: inserted.length,
      duplicates,
      ...reconciliationResult,
    })

    this.logger.info("Bank statement import job finished", {
      churchId: payload.churchId,
      bankId: bank.getBankId(),
      month: payload.month,
      year: payload.year,
      ...reconciliationResult,
      duplicates,
    })
  }

  private async persistNewStatements(
    intermediates: IntermediateBankStatement[]
  ): Promise<{
    inserted: BankStatement[]
    duplicates: number
  }> {
    const statementsToInsert: BankStatement[] = []
    let duplicates = 0

    for (const intermediate of intermediates) {
      const existingByFitId = await this.bankStatementRepository.one({
        churchId: intermediate.bank.getChurchId(),
        "bank.bankId": intermediate.bank.getBankId(),
        fitId: intermediate.fitId,
      })

      if (existingByFitId) {
        duplicates++
        continue
      }

      const existingByHash = await this.bankStatementRepository.one({
        churchId: intermediate.bank.getChurchId(),
        "bank.bankId": intermediate.bank.getBankId(),
        hash: intermediate.hash,
      })

      if (existingByHash) {
        duplicates++
        continue
      }

      statementsToInsert.push(BankStatement.create(intermediate))
    }

    await this.bankStatementRepository.bulkInsert(statementsToInsert)

    return { inserted: statementsToInsert, duplicates }
  }

  private async reconcileStatements(statements: BankStatement[]): Promise<{
    matched: number
    unmatched: number
  }> {
    let matched = 0
    let unmatched = 0

    for (const statement of statements) {
      const result = await this.reconciler.execute(statement)

      if (result.matched) {
        matched++
      } else {
        unmatched++
      }
    }

    return { matched, unmatched }
  }

  private async notifyResult(params: {
    payload: ImportBankStatementJobPayload
    bankName: string
    accountName: string
    total: number
    inserted: number
    duplicates: number
    matched: number
    unmatched: number
  }): Promise<void> {
    const {
      payload,
      total,
      accountName,
      inserted,
      duplicates,
      matched,
      unmatched,
      bankName,
    } = params

    const message = [
      `📥 Importação de extrato bancário concluída`,
      `Banco: ${bankName}`,
      `Conta: ${accountName}`,
      `Igreja: ${payload.churchId}`,
      `Referência: ${payload.month.toString().padStart(2, "0")}/${payload.year}`,
      payload.uploadedBy ? `Enviado por: ${payload.uploadedBy}` : undefined,
      `Total linhas: ${total}`,
      `Novos registros: ${inserted}`,
      `Duplicados ignorados: ${duplicates}`,
      `Conciliados automaticamente: ${matched}`,
      `Pendentes: ${unmatched}`,
    ]
      .filter(Boolean)
      .join("\n")

    this.queueService.dispatch(QueueName.TelegramNotificationJob, { message })
  }
}
