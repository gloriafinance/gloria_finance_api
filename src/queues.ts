import { IDefinitionQueue } from "./Shared/domain"
import { CreateUserForMemberJob } from "./SecuritySystem/applications"
import {
  PasswordAdapter,
  UserMongoRepository,
} from "./SecuritySystem/infrastructure"
import { FinancialQueue } from "./Financial/infrastructure/Financal.queue"
import { FinanceRecordMongoRepository } from "@/Financial/infrastructure/persistence"
import { SendMailJob } from "./SendMail/SendMail.job"
import { TelegramNotificationJob } from "./Shared/infrastructure"
import { PatrimonyQueue } from "@/Patrimony/infrastructure/Patrimony.queue"
import { BankingQueue } from "@/Banking/infrastructure/Banking.queue"
import { SecuritySystemQueue } from "@/SecuritySystem/infrastructure/SecuritySystem.queue"
import { CustomerQueue } from "@/Customers/infrastructure/Customer.queue"
import { PurchasesQueue } from "@/Purchases/infrastructure/Purchases.queue"
import { NotifyFCMJob } from "@/Notifications/infrastructure/NotifyFCM.job"
import { NotificationMongoRepository } from "@/Notifications/infrastructure/persistence"
import { FCMNotificationService } from "@/Notifications/infrastructure/services/FCMNotification.service"

export const Queues = (): IDefinitionQueue[] => [
  ...BankingQueue({
    financialRecordRepository: FinanceRecordMongoRepository.getInstance(),
  }),
  ...FinancialQueue(),
  ...PatrimonyQueue(),
  ...SecuritySystemQueue(),
  ...CustomerQueue(),
  ...PurchasesQueue(),
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
  {
    useClass: NotifyFCMJob,
    inject: [
      NotificationMongoRepository.getInstance(),
      FCMNotificationService.getInstance(),
    ],
    delay: 4,
  },
]
