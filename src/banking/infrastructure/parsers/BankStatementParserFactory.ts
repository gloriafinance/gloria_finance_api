import { IBankStatementParser } from "@/banking/domain"
import { NubankCsvParser } from "./NubankCsvParser"

export class BankStatementParserFactory {
  private static instance: BankStatementParserFactory
  private readonly parsers: IBankStatementParser[]

  private constructor(parsers: IBankStatementParser[]) {
    this.parsers = parsers
  }

  static getInstance(): BankStatementParserFactory {
    if (!BankStatementParserFactory.instance) {
      BankStatementParserFactory.instance = new BankStatementParserFactory([
        new NubankCsvParser(),
      ])
    }

    return BankStatementParserFactory.instance
  }

  resolve(bank: string): IBankStatementParser {
    const parser = this.parsers.find((item) => item.supports(bank))

    if (!parser) {
      throw new Error(`No parser registered for bank ${bank}`)
    }

    return parser
  }
}

