import { IDefinitionQueue } from "@/Shared/domain"
import {
  AvailabilityAccountMasterMongoRepository,
  AvailabilityAccountMongoRepository,
  CostCenterMasterMongoRepository,
  FinanceRecordMongoRepository,
  FinancialConfigurationMongoRepository,
} from "./persistence"
import {
  UpdateAvailabilityAccountBalanceJob,
  UpdateFinancialRecordJob,
} from "../applications"
import { UpdateCostCenterMasterJob } from "../applications/jobs/UpdateCostCenterMaster.job"
import { CreateFinancialRecordJob } from "@/Financial/applications/jobs/CreateFinancialRecord.job"
import { QueueService, StorageGCP } from "@/Shared/infrastructure"
import { FinancialYearMongoRepository } from "@/ConsolidatedFinancial/infrastructure"

export const FinancialQueue = (): IDefinitionQueue[] => [
  {
    useClass: UpdateCostCenterMasterJob,
    inject: [
      FinancialConfigurationMongoRepository.getInstance(),
      CostCenterMasterMongoRepository.getInstance(),
    ],
  },

  {
    useClass: CreateFinancialRecordJob,
    inject: [
      FinancialYearMongoRepository.getInstance(),
      FinanceRecordMongoRepository.getInstance(),
      StorageGCP.getInstance(process.env.BUCKET_FILES),
      QueueService.getInstance(),
    ],
  },
  {
    useClass: UpdateFinancialRecordJob,
    inject: [
      FinancialYearMongoRepository.getInstance(),
      FinanceRecordMongoRepository.getInstance(),
      AvailabilityAccountMongoRepository.getInstance(),
      QueueService.getInstance(),
    ],
    delay: 3,
  },
  {
    useClass: UpdateAvailabilityAccountBalanceJob,
    inject: [
      AvailabilityAccountMongoRepository.getInstance(),
      AvailabilityAccountMasterMongoRepository.getInstance(),
    ],
  },
]
