import { BaseServerService } from "@abejarano/ts-express-server"
import { Server as HttpServer } from "http"
import {
  BankStatementParserFactory,
  NuBankCsvParser,
} from "@/Banking/infrastructure/parsers"

export class FactoryService extends BaseServerService {
  name = "FactoryService"
  priority = -90

  start(http: HttpServer): Promise<void> | void {
    BankStatementParserFactory.initialize([new NuBankCsvParser()])
  }
}
