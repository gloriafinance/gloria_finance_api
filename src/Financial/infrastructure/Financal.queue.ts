import { IDefinitionQueue } from "@/Shared/domain"
import {
  AvailabilityAccountMongoRepository,
  CostCenterMasterMongoRepository,
  FinanceRecordMongoRepository,
} from "./persistence"
import {
  RebuildAvailabilityMasterAccountJob,
  UpdateFinancialRecordJob,
} from "../applications"
import {
  CreateFinancialRecordJob,
  RebuildCostCenterMasterJob,
  UpdateCostCenterMasterJob,
} from "@/Financial/applications"
import { QueueService, StorageGCP } from "@/Shared/infrastructure"
import { FinancialYearMongoRepository } from "@/ConsolidatedFinancial/infrastructure"
import { FinancialConfigurationMongoRepository } from "@/FinanceConfig/infrastructure/presistence"
import { AvailabilityAccountMasterMongoRepository } from "@/Financial/infrastructure/persistence/AvailabilityAccountMasterMongoRepository"
import { UpdateAvailabilityAccountBalanceJob } from "@/Financial/applications/jobs/UpdateAvailabilityAccountBalance.job"

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
