import { BaseServerService, type ServerInstance } from "bun-platform-kit"

import {
  BankStatementParserFactory,
  NuBankCsvParser,
} from "@/Banking/infrastructure/parsers"
import { RunSubscribeEvent } from "@/bootstrap/RunSubscribeEvent.ts"

export class FactoryService extends BaseServerService {
  name = "FactoryService"
  priority = -90

  start(http: ServerInstance): Promise<void> | void {
    BankStatementParserFactory.initialize([new NuBankCsvParser()])
    RunSubscribeEvent()
  }
}
