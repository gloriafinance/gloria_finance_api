import { IDefinitionQueue } from "./Shared/domain"
import { CreateUserForMember } from "./SecuritySystem/applications"
import {
  PasswordAdapter,
  UserMongoRepository,
} from "./SecuritySystem/infrastructure"
import { InitialLoadingFinancialConcepts } from "./Financial/applications"
import { ChurchMongoRepository } from "./Church/infrastructure"
import { FinancialQueue } from "./Financial/infrastructure/Financal.queue"
import { SendMail } from "./SendMail/SendMail"
import { TelegramNotification } from "./Shared/infrastructure"
import { FinancialConceptMongoRepository } from "@/Financial/infrastructure/persistence"

export const Queues = (): IDefinitionQueue[] => [
  ...FinancialQueue(),
  {
    useClass: CreateUserForMember,
    inject: [UserMongoRepository.getInstance(), new PasswordAdapter()],
  },
  {
    useClass: InitialLoadingFinancialConcepts,
    inject: [
      FinancialConceptMongoRepository.getInstance(),
      ChurchMongoRepository.getInstance(),
    ],
  },
  {
    useClass: SendMail,
    inject: [],
    delay: 4,
  },
  {
    useClass: TelegramNotification,
    delay: 4,
  },
]
