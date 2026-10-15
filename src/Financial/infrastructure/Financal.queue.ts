import {
  AvailabilityAccountMongoRepository,
  CostCenterMasterMongoRepository,
  FinanceRecordMongoRepository,
  RecurringPaymentsMongoRepository,
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
import { QueueService, StorageProviderService } from "@/Shared/infrastructure"
import { FinancialYearMongoRepository } from "@/ConsolidatedFinancial/infrastructure"
import { FinancialConfigurationMongoRepository } from "@/FinanceConfig/infrastructure/presistence"
import { AvailabilityAccountMasterMongoRepository } from "@/Financial/infrastructure/persistence/AvailabilityAccountMasterMongoRepository"
import { UpdateAvailabilityAccountBalanceJob } from "@/Financial/applications/jobs/UpdateAvailabilityAccountBalance.job"
import type { IListQueue } from "@/package/queue/domain"
import { CloseFinancialMonth } from "@/Financial/infrastructure/jobs"
import { NotifyRecurringPaymentDue } from "@/Financial/applications/jobs/NotifyRecurringPaymentDue.job"
import { ChurchMongoRepository } from "@/Church/infrastructure"
import {
  UserAssignmentMongoRepository,
  UserMongoRepository,
} from "@/SecuritySystem/infrastructure"
import { CacheProviderService } from "@/Shared/infrastructure/services/CacheProvider.service"

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
      StorageProviderService.getInstance(),
      QueueService.getInstance(),
      RecurringPaymentsMongoRepository.getInstance(),
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
  {
    name: "CloseFinancialMonth",
    useClass: CloseFinancialMonth,
    scheduler: {
      pattern: "30 23 * * *",
      tz: "America/Sao_Paulo",
    },
  },
  {
    name: NotifyRecurringPaymentDue.name,
    useClass: NotifyRecurringPaymentDue,
    inject: [
      ChurchMongoRepository.getInstance(),
      RecurringPaymentsMongoRepository.getInstance(),
      FinanceRecordMongoRepository.getInstance(),
      UserAssignmentMongoRepository.getInstance(),
      UserMongoRepository.getInstance(),
      QueueService.getInstance(),
      CacheProviderService.getInstance(),
    ],
    scheduler: {
      pattern: "0 9 * * *",
      tz: "America/Sao_Paulo",
    },
  },
]
