import { BaseServerService, ServerInstance } from "@abejarano/ts-express-server"

import {
  BankStatementParserFactory,
  NuBankCsvParser,
} from "@/Banking/infrastructure/parsers"

export class FactoryService extends BaseServerService {
  name = "FactoryService"
  priority = -90

  start(http: ServerInstance): Promise<void> | void {
    BankStatementParserFactory.initialize([new NuBankCsvParser()])
  }
}
