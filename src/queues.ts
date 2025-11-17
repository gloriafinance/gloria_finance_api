import { IDefinitionQueue } from "./Shared/domain"
import { CreateUserForMemberJob } from "./SecuritySystem/applications"
import {
  PasswordAdapter,
  UserMongoRepository,
} from "./SecuritySystem/infrastructure"
import { FinancialQueue } from "./Financial/infrastructure/Financal.queue"
import { SendMailJob } from "./SendMail/SendMail.job"
import { TelegramNotificationJob } from "./Shared/infrastructure"
import { PatrimonyQueue } from "@/Patrimony/infrastructure/Patrimony.queue"
import { BankingQueue } from "@/Banking/infrastructure/Banking.queue"
import { SecuritySystemQueue } from "@/SecuritySystem/infrastructure/SecuritySystem.queue"
import { CustomerQueue } from "@/Customers/infrastructure/Customer.queue"

export const Queues = (): IDefinitionQueue[] => [
  ...BankingQueue(),
  ...FinancialQueue(),
  ...PatrimonyQueue(),
  ...SecuritySystemQueue(),
  ...CustomerQueue(),
  {
    useClass: CreateUserForMemberJob,
    inject: [UserMongoRepository.getInstance(), new PasswordAdapter()],
  },

  {
    useClass: SendMailJob,
    inject: [],
    delay: 4,
  },
  {
    useClass: TelegramNotificationJob,
    delay: 4,
  },
]
