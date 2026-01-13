import { BankController } from "./Bank.controller"
import { BankStatementController } from "./BankStatement.controller"

export const bankControllers = () => [BankController, BankStatementController]
