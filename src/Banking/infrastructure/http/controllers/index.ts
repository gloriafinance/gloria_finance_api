import { BankController } from "./Bank.controller"
import { BankStatementController } from "./BankStatement.controller"
import { BankingOnboardingController } from "./BankingOnboarding.controller"

export const bankControllers = () => [
  BankController,
  BankStatementController,
  BankingOnboardingController,
]
