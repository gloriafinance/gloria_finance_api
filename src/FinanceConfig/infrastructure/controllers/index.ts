import { AvailabilityAccountController } from "@/FinanceConfig/infrastructure/controllers/AvailabilityAccount.controller"
import { CostCenterController } from "@/FinanceConfig/infrastructure/controllers/CostCenter.controller"
import { FinancialConceptController } from "@/FinanceConfig/infrastructure/controllers/FinancialConcept.controller"
import { IAAssistanceFinancialConceptController } from "@/FinanceConfig/infrastructure/controllers/FinancialConceptAssitence.controller.ts"

export const financeConfigControllers = () => [
  AvailabilityAccountController,
  CostCenterController,
  FinancialConceptController,
  IAAssistanceFinancialConceptController,
]
