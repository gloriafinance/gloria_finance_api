import { IDefinitionQueue } from "@/Shared/domain"
import { OnboardingCustomerJob } from "@/Customers/infrastructure/jobs/OnboardingCustomer.job"
import { QueueService } from "@/Shared/infrastructure"
import { ChurchMongoRepository } from "@/Church/infrastructure"
import { CustomerMongoRepository } from "@/Customers/infrastructure/persistence/CustomerMongoRepository"

import { FinancialYearMongoRepository } from "@/ConsolidatedFinancial/infrastructure"
import { FinancialConceptMongoRepository } from "@/FinanceConfig/infrastructure/presistence"

export const CustomerQueue = (): IDefinitionQueue[] => [
  {
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
