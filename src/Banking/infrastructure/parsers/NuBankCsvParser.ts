import { parse } from "@fast-csv/parse"
import { createHash } from "crypto"
import { Logger } from "@/Shared/adapter/CustomLogger"
import { Readable } from "node:stream"
import {
  Bank,
  BankStatementDirection,
  type IBankStatementParser,
  type IntermediateBankStatement,
} from "@/Banking/domain"

type NubankCsvRow = {
  Data: string
  Valor: string
  Identificador: string
  Descrição: string
}

const BANK_CODE = "NUBANK"

export class NuBankCsvParser implements IBankStatementParser {
  private logger = Logger(NuBankCsvParser.name)

  supports(bank: string): boolean {
    return bank.toUpperCase() === BANK_CODE
  }

  async parse(params: {
    bank: Bank
    availabilityAccount: {
      accountName: string
      availabilityAccountId: string
    }
    fileContent: string
    month: number
    year: number
  }): Promise<IntermediateBankStatement[]> {
    const { fileContent, bank, month, year, availabilityAccount } = params

    this.logger.info("Parsing Nubank CSV bank statement", {
      contentLength: fileContent.length,
      bank,
      month,
      year,
    })

    const statements: IntermediateBankStatement[] = []
    await new Promise<void>((resolve, reject) => {
      const csvStream = Readable.from([fileContent]).pipe(
        parse<NubankCsvRow, NubankCsvRow>({
          headers: true,
          trim: true,
          ignoreEmpty: true,
        })
      )

      csvStream
        .on("error", (error) => reject(error))
        .on("data", (row: NubankCsvRow) => {
          const postedAt = this.toUtcDate(row.Data)
          const amount = Number(row.Valor.replace(",", "."))
          const direction =
            amount >= 0
              ? BankStatementDirection.INCOME
              : BankStatementDirection.OUTGO
          const normalizedAmount = Math.abs(amount)
          const description = row["Descrição"]?.trim() ?? ""
          const bankRefId = row.Identificador?.trim() ?? ""
          const fitId = `${BANK_CODE}:${bankRefId}`
          const hash = this.createHash({
            postedAt,
            amount: normalizedAmount,
            description,
          })

          statements.push({
            bank,
            availabilityAccount,
            bankRefId,
            postedAt,
            amount: normalizedAmount,
            description,
            direction,
            fitId,
            hash,
            month,
            year,
            raw: row as unknown as Record<string, unknown>,
          })
        })
        .on("end", () => resolve())
    })

    return statements
  }

  private toUtcDate(value: string): Date {
    const [day, month, year] = value
      .split("/")
      .map((item) => parseInt(item, 10))
    return new Date(Date.UTC(year, month - 1, day))
  }

  private createHash(payload: {
    postedAt: Date
    amount: number
    description: string
  }): string {
    const base = `${payload.postedAt.toISOString()}|${payload.amount.toFixed(
      2
    )}|${payload.description.slice(0, 80)}`
    return createHash("sha1").update(base).digest("hex")
  }
}
