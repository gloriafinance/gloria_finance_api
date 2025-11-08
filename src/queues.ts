import { IDefinitionQueue } from "./Shared/domain"
import { CreateUserForMember } from "./SecuritySystem/applications"
import {
  PasswordAdapter,
  UserMongoRepository,
} from "./SecuritySystem/infrastructure"
import { FinancialQueue } from "./Financial/infrastructure/Financal.queue"
import { SendMail } from "./SendMail/SendMail"
import { TelegramNotification } from "./Shared/infrastructure"
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
    useClass: CreateUserForMember,
    inject: [UserMongoRepository.getInstance(), new PasswordAdapter()],
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
