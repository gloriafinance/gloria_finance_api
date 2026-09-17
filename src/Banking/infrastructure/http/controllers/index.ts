import { BankController } from "./Bank.controller"
import { BankStatementController } from "./BankStatement.controller"
import { AuthJwksController } from "./AuthJwks.controller"
import { PaymentController } from "./Payment.controller"

export const bankControllers = () => [
  BankController,
  BankStatementController,
  AuthJwksController,
  PaymentController,
]
