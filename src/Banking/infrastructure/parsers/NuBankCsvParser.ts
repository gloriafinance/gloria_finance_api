import { createReadStream } from "node:fs"
import { parse } from "@fast-csv/parse"
import { createHash } from "crypto"
import { once } from "events"
import { Logger } from "@/Shared/adapter/CustomLogger"
import {
  Bank,
  BankStatementDirection,
  IBankStatementParser,
  IntermediateBankStatement,
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
    filePath: string
    month: number
    year: number
  }): Promise<IntermediateBankStatement[]> {
    const { filePath, bank, month, year, availabilityAccount } = params

    this.logger.info("Parsing Nubank CSV bank statement", {
      filePath,
      bank,
      month,
      year,
    })

    const stream = createReadStream(filePath, { encoding: "utf-8" })
    const csvStream = stream.pipe(
      parse<NubankCsvRow, NubankCsvRow>({
        headers: true,
        trim: true,
        ignoreEmpty: true,
      })
    )

    const statements: IntermediateBankStatement[] = []
    const errors: Error[] = []

    csvStream.on("data", (row: NubankCsvRow) => {
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

    csvStream.on("error", (error) => {
      errors.push(error instanceof Error ? error : new Error(String(error)))
    })

    await once(csvStream, "end")

    if (errors.length > 0) {
      throw errors[0]
    }

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
