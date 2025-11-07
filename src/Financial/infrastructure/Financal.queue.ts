import { IDefinitionQueue } from "@/Shared/domain"
import {
  AvailabilityAccountMasterMongoRepository,
  AvailabilityAccountMongoRepository,
  CostCenterMasterMongoRepository,
  FinanceRecordMongoRepository,
  FinancialConfigurationMongoRepository,
} from "./persistence"
import {
  UpdateAvailabilityAccountBalance,
  UpdateFinancialRecord,
} from "../applications"
import { UpdateCostCenterMaster } from "../applications/costCenter/UpdateCostCenterMaster"
import { CreateFinancialRecord } from "@/Financial/applications/financeRecord/CreateFinancialRecord"
import { QueueService, StorageGCP } from "@/Shared/infrastructure"
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
      FinancialYearMongoRepository.getInstance(),
      FinanceRecordMongoRepository.getInstance(),
      AvailabilityAccountMongoRepository.getInstance(),
      QueueService.getInstance(),
    ],
    delay: 3,
  },
  {
    useClass: UpdateAvailabilityAccountBalance,
    inject: [
      AvailabilityAccountMongoRepository.getInstance(),
      AvailabilityAccountMasterMongoRepository.getInstance(),
    ],
  },
]
