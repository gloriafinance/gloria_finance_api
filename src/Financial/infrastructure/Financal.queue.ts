import { IDefinitionQueue } from "@/Shared/domain"
import { MovementBankRecord } from "@/MovementBank/applications"
import { MovementBankMongoRepository } from "@/MovementBank/infrastructure/persistence"
import {
  AvailabilityAccountMasterMongoRepository,
  AvailabilityAccountMongoRepository,
  CostCenterMasterMongoRepository,
  FinanceRecordMongoRepository,
  FinancialConfigurationMongoRepository,
} from "./persistence"
import { UpdateAvailabilityAccountBalance } from "../applications"
import { UpdateCostCenterMaster } from "../applications/costCenter/UpdateCostCenterMaster"
import { CreateFinancialRecord } from "@/Financial/applications/financeRecord/CreateFinancialRecord"
import { QueueService, StorageGCP } from "@/Shared/infrastructure"
import { FinancialYearMongoRepository } from "@/ConsolidatedFinancial/infrastructure"
import { UpdateFinancialRecord } from "@/Financial/applications/financeRecord/UpdateFinanceRecord"

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
    useClass: CreateFinancialRecord,
    inject: [
      FinancialYearMongoRepository.getInstance(),
      FinanceRecordMongoRepository.getInstance(),
      StorageGCP.getInstance(process.env.BUCKET_FILES),
      QueueService.getInstance(),
    ],
  },
  {
    useClass: UpdateFinancialRecord,
    inject: [
      FinanceRecordMongoRepository.getInstance(),
      StorageGCP.getInstance(process.env.BUCKET_FILES),
      QueueService.getInstance(),
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
