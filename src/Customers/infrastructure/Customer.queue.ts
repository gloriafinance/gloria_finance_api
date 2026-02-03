import { OnboardingCustomerJob } from "@/Customers/infrastructure/jobs/OnboardingCustomer.job"
import { QueueService } from "@/Shared/infrastructure"
import { ChurchMongoRepository } from "@/Church/infrastructure"
import { CustomerMongoRepository } from "@/Customers/infrastructure/persistence/CustomerMongoRepository"

import { FinancialYearMongoRepository } from "@/ConsolidatedFinancial/infrastructure"
import { FinancialConceptMongoRepository } from "@/FinanceConfig/infrastructure/presistence"
import type { IListQueue } from "@/package/queue/domain"

export const CustomerQueue = (): IListQueue[] => [
  {
    name: OnboardingCustomerJob.name,
    useClass: OnboardingCustomerJob,
    inject: [
      QueueService.getInstance(),
      ChurchMongoRepository.getInstance(),
      CustomerMongoRepository.getInstance(),
      FinancialConceptMongoRepository.getInstance(),
      FinancialYearMongoRepository.getInstance(),
    ],
    delay: 5,
  },
]
