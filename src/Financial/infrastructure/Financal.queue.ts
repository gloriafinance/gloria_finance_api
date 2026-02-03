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
import type { IListQueue } from "@/package/queue/domain"

export const FinancialQueue = (): IListQueue[] => [
  {
    name: RebuildCostCenterMasterJob.name,
    useClass: RebuildCostCenterMasterJob,
    inject: [CostCenterMasterMongoRepository.getInstance()],
  },
  {
    name: RebuildAvailabilityMasterAccountJob.name,
    useClass: RebuildAvailabilityMasterAccountJob,
    inject: [AvailabilityAccountMasterMongoRepository.getInstance()],
  },
  {
    name: UpdateCostCenterMasterJob.name,
    useClass: UpdateCostCenterMasterJob,
    inject: [
      FinancialConfigurationMongoRepository.getInstance(),
      CostCenterMasterMongoRepository.getInstance(),
    ],
  },

  {
    name: CreateFinancialRecordJob.name,
    useClass: CreateFinancialRecordJob,
    inject: [
      FinancialYearMongoRepository.getInstance(),
      FinanceRecordMongoRepository.getInstance(),
      StorageGCP.getInstance(process.env.BUCKET_FILES!),
      QueueService.getInstance(),
    ],
  },
  {
    name: UpdateFinancialRecordJob.name,
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
    name: UpdateAvailabilityAccountBalanceJob.name,
    useClass: UpdateAvailabilityAccountBalanceJob,
    inject: [
      AvailabilityAccountMongoRepository.getInstance(),
      AvailabilityAccountMasterMongoRepository.getInstance(),
    ],
  },
]
