import { IBankStatementParser } from "@/Banking/domain"
import { NuBankCsvParser } from "./NuBankCsvParser"

export class BankStatementParserFactory {
  private static instance: BankStatementParserFactory
  private readonly parsers: IBankStatementParser[]

  private constructor(parsers: IBankStatementParser[]) {
    this.parsers = parsers
  }

  static getInstance(): BankStatementParserFactory {
    if (!BankStatementParserFactory.instance) {
      BankStatementParserFactory.instance = new BankStatementParserFactory([
        new NuBankCsvParser(),
      ])
    }

    return BankStatementParserFactory.instance
  }

  static initialize(parsers: IBankStatementParser[]): void {
    BankStatementParserFactory.instance = new BankStatementParserFactory(
      parsers
    )
  }

  resolve(bank: string): IBankStatementParser {
    const parser = this.parsers.find((item) => item.supports(bank))

    if (!parser) {
      throw new Error(`No parser registered for bank ${bank}`)
    }

    return parser
  }
}
