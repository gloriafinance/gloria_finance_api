import { CreateUserForMemberJob } from "./SecuritySystem/applications"
import {
  PasswordAdapter,
  UserMongoRepository,
} from "./SecuritySystem/infrastructure"
import { FinancialQueue } from "./Financial/infrastructure/Financal.queue"
import { FinanceRecordMongoRepository } from "@/Financial/infrastructure/persistence"
import { TelegramNotificationJob } from "./Shared/infrastructure"
import { PatrimonyQueue } from "@/Patrimony/infrastructure/Patrimony.queue"
import { BankingQueue } from "@/Banking/infrastructure/Banking.queue"
import { SecuritySystemQueue } from "@/SecuritySystem/infrastructure/SecuritySystem.queue"
import { CustomerQueue } from "@/Customers/infrastructure/Customer.queue"
import { PurchasesQueue } from "@/Purchases/infrastructure/Purchases.queue"
import { NotifyFCMJob } from "@/PushNotifications/infrastructure/NotifyFCM.job"
import { NotificationMongoRepository } from "@/PushNotifications/infrastructure/persistence"
import { FCMNotificationService } from "@/PushNotifications/infrastructure/services/FCMNotification.service"
import type { IListQueue } from "@/package/queue/domain"
import { SendMailJob } from "./package/email/SendMail.job"
import { IncomeStatementJob } from "./Reports/infrastructure/http/jobs/incomeStatement.job"

export const Queues = (): IListQueue[] => [
  ...BankingQueue({
    financialRecordRepository: FinanceRecordMongoRepository.getInstance(),
  }),
  ...FinancialQueue(),
  ...PatrimonyQueue(),
  ...SecuritySystemQueue(),
  ...CustomerQueue(),
  ...PurchasesQueue(),
  {
    name: CreateUserForMemberJob.name,
    useClass: CreateUserForMemberJob,
    inject: [UserMongoRepository.getInstance(), new PasswordAdapter()],
  },

  {
    name: SendMailJob.name,
    useClass: SendMailJob,
    inject: [],
    delay: 4,
  },
  {
    name: TelegramNotificationJob.name,
    useClass: TelegramNotificationJob,
    delay: 4,
  },
  {
    name: NotifyFCMJob.name,
    useClass: NotifyFCMJob,
    inject: [
      NotificationMongoRepository.getInstance(),
      FCMNotificationService.getInstance(),
    ],
    delay: 4,
  },
  {
    name: IncomeStatementJob.name,
    useClass: IncomeStatementJob,
  },
]
