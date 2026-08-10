import { BankController } from "./Bank.controller"
import { BankStatementController } from "./BankStatement.controller"
import { ChurchBankingJwksController } from "./ChurchBankingJwks.controller"

export const bankControllers = () => [
  BankController,
  BankStatementController,
  ChurchBankingJwksController,
]
