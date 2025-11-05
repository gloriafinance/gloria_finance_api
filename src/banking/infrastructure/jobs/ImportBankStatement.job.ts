import { promises as fs } from "fs"
import { Logger } from "@/Shared/adapter/CustomLogger"
import { IQueue, IQueueService, QueueName } from "@/Shared/domain"
import {
  BankStatement,
  IBankStatementRepository,
  IntermediateBankStatement,
} from "@/banking/domain"
import { BankStatementParserFactory } from "../parsers/BankStatementParserFactory"
import { BankStatementReconciler } from "../services/BankStatementReconciler"

type ImportBankStatementJobPayload = {
  churchId: string
  bank: string
  accountName?: string
  month: number
  year: number
  filePath: string
  uploadedBy?: string
}

export class ImportBankStatementJob implements IQueue {
  private readonly logger = Logger(ImportBankStatementJob.name)

  constructor(
    private readonly parserFactory: BankStatementParserFactory,
    private readonly bankStatementRepository: IBankStatementRepository,
    private readonly reconciler: BankStatementReconciler,
    private readonly queueService: IQueueService
  ) {}

  async handle(payload: ImportBankStatementJobPayload): Promise<void> {
    this.logger.info("Starting bank statement import job", payload)

    let localFilePath: string | undefined

    try {
      localFilePath = this.resolveFilePath(payload)
      const parser = this.parserFactory.resolve(payload.bank)

      const intermediates = await parser.parse({
        filePath: localFilePath,
        churchId: payload.churchId,
        accountName: payload.accountName,
        month: payload.month,
        year: payload.year,
      })

      const { inserted, duplicates } =
        await this.persistNewStatements(intermediates)

      const reconciliationResult = await this.reconcileStatements(inserted)

      await this.notifyResult({
        payload,
        total: intermediates.length,
        inserted: inserted.length,
        duplicates,
        ...reconciliationResult,
      })

      this.logger.info("Bank statement import job finished", {
        ...payload,
        ...reconciliationResult,
        duplicates,
      })
    } finally {
      if (localFilePath) {
        await this.cleanupTempFile(payload, localFilePath)
      }
    }
  }

  private resolveFilePath(payload: ImportBankStatementJobPayload): string {
    if (!payload.filePath) {
      throw new Error("ImportBankStatementJob requires a local file path")
    }

    return payload.filePath
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
      const existingByFitId = await this.bankStatementRepository.findByFitId(
        intermediate.churchId,
        intermediate.bank,
        intermediate.fitId
      )

      if (existingByFitId) {
        duplicates++
        continue
      }

      const existingByHash = await this.bankStatementRepository.findByHash(
        intermediate.churchId,
        intermediate.bank,
        intermediate.hash
      )

      if (existingByHash) {
        duplicates++
        continue
      }

      statementsToInsert.push(
        BankStatement.createFromIntermediate(intermediate)
      )
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
      const result = await this.reconciler.reconcile(statement)

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
    total: number
    inserted: number
    duplicates: number
    matched: number
    unmatched: number
  }): Promise<void> {
    const { payload, total, inserted, duplicates, matched, unmatched } = params

    const message = [
      `📥 Importação de extrato bancário concluída`,
      `Banco: ${payload.bank}`,
      payload.accountName ? `Conta: ${payload.accountName}` : undefined,
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

    this.queueService.dispatch(QueueName.TelegramNotification, { message })
  }

  private async cleanupTempFile(
    payload: ImportBankStatementJobPayload,
    localFilePath: string
  ): Promise<void> {
    const shouldSkipCleanup =
      /^https?:\/\//i.test(localFilePath) || !localFilePath

    if (shouldSkipCleanup) {
      // External URL, nothing to cleanup
      return
    }

    try {
      await fs.unlink(localFilePath)
    } catch (error) {
      this.logger.error("Failed to remove temporary bank statement file", {
        localFilePath,
        error,
      })
    }
  }
}
