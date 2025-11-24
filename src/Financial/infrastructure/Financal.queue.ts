import { IDefinitionQueue } from "@/Shared/domain"
import {
  AvailabilityAccountMasterMongoRepository,
  AvailabilityAccountMongoRepository,
  CostCenterMasterMongoRepository,
  FinanceRecordMongoRepository,
  FinancialConfigurationMongoRepository,
} from "./persistence"
import {
  RebuildAvailabilityMasterAccountJob,
  UpdateAvailabilityAccountBalanceJob,
  UpdateFinancialRecordJob,
} from "../applications"
import { UpdateCostCenterMasterJob } from "../applications/jobs/UpdateCostCenterMaster.job"
import { CreateFinancialRecordJob } from "@/Financial/applications/jobs/CreateFinancialRecord.job"
import { QueueService, StorageGCP } from "@/Shared/infrastructure"
import { FinancialYearMongoRepository } from "@/ConsolidatedFinancial/infrastructure"
import { RebuildCostCenterMasterJob } from "@/Financial/applications/jobs/RebuildCostCenterMaster.job"

export const FinancialQueue = (): IDefinitionQueue[] => [
  {
    useClass: RebuildCostCenterMasterJob,
    inject: [CostCenterMasterMongoRepository.getInstance()],
  },
  {
    useClass: RebuildAvailabilityMasterAccountJob,
    inject: [AvailabilityAccountMasterMongoRepository.getInstance()],
  },
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
