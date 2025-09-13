import { IDefinitionQueue } from "@/Shared/domain"
import { MovementBankRecord } from "@/MovementBank/applications"
import { MovementBankMongoRepository } from "@/MovementBank/infrastructure/persistence"
import {
  AvailabilityAccountMasterMongoRepository,
  AvailabilityAccountMongoRepository,
  CostCenterMasterMongoRepository,
  FinanceRecordMongoRepository,
  FinancialConceptMongoRepository,
  FinancialConfigurationMongoRepository,
} from "./persistence"
import { RegisterFinancialRecord } from "@/Financial/applications"
import { UpdateAvailabilityAccountBalance } from "../applications"
import { UpdateCostCenterMaster } from "../applications/costCenter/UpdateCostCenterMaster"
import { FinancialYearMongoRepository } from "@/ConsolidatedFinancial/infrastructure"

export const FinancialQueue = (): IDefinitionQueue[] => [
  {
    useClass: UpdateCostCenterMaster,
    inject: [
      FinancialConfigurationMongoRepository.getInstance(),
      CostCenterMasterMongoRepository.getInstance(),
    ],
  },
  {
    useClass: MovementBankRecord,
    inject: [
      MovementBankMongoRepository.getInstance(),
      FinancialConfigurationMongoRepository.getInstance(),
    ],
  },
  {
    useClass: RegisterFinancialRecord,
    inject: [
      FinancialYearMongoRepository.getInstance(),
      FinanceRecordMongoRepository.getInstance(),
      FinancialConceptMongoRepository.getInstance(),
      AvailabilityAccountMongoRepository.getInstance(),
    ],
  },
  {
    useClass: UpdateAvailabilityAccountBalance,
    inject: [
      AvailabilityAccountMongoRepository.getInstance(),
      AvailabilityAccountMasterMongoRepository.getInstance(),
    ],
  },
]
