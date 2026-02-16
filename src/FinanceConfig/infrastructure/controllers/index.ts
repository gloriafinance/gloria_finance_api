import { AvailabilityAccountController } from "@/FinanceConfig/infrastructure/controllers/AvailabilityAccount.controller"
import { CostCenterController } from "@/FinanceConfig/infrastructure/controllers/CostCenter.controller"
import { FinancialConceptController } from "@/FinanceConfig/infrastructure/controllers/FinancialConcept.controller"
import { IntegrationsController } from "./Integrations.controller"

export const financeConfigControllers = () => [
  AvailabilityAccountController,
  CostCenterController,
  FinancialConceptController,
  IntegrationsController,
]
