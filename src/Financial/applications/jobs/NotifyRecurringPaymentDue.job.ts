import type { IChurchRepository } from "@/Church/domain/interfaces/ChurchRepository.interface"
import { ChurchStatus } from "@/Church/domain/enums/ChurchStatus.enum"
import type { IRecurringPaymentsRepository } from "@/Financial/domain"
import type { IFinancialRecordRepository } from "@/Financial/domain/interfaces/FinancialRecordRepository.interface"
import {
  QueueName,
  type IQueueService,
  type IJob,
} from "@/package/queue/domain"
import type {
  IUserAssignmentRepository,
  IUserRepository,
} from "@/SecuritySystem/domain"
import type { ICacheService } from "@/Shared/domain"
import { Logger } from "@/Shared/adapter/CustomLogger"
import { Order } from "@abejarano/ts-mongodb-criteria"
import { NotificationsTopic } from "@/PushNotifications/domain/enums/NotificationsTopic.enum"
import type { NotificationRequest } from "@/PushNotifications/domain/types/NotificationRequest.type"
import {
  dueDateForCompetence,
  saoPauloDate,
} from "@/Financial/applications/recurringPayments/RecurringPaymentCompetence"

const REMINDER_OFFSETS = [5, 2, 0] as const

export class NotifyRecurringPaymentDue implements IJob {
  private readonly logger = Logger(NotifyRecurringPaymentDue.name)

  constructor(
    private readonly churchRepository: IChurchRepository,
    private readonly recurringRepository: IRecurringPaymentsRepository,
    private readonly financialRecordRepository: IFinancialRecordRepository,
    private readonly userAssignmentRepository: IUserAssignmentRepository,
    private readonly userRepository: IUserRepository,
    private readonly queueService: IQueueService,
    private readonly cacheService: ICacheService,
    private readonly now: () => Date = () => new Date()
  ) {}

  async handle(): Promise<void> {
    const today = saoPauloDate(this.now())
    const churches = await this.churchRepository.all({
      status: ChurchStatus.ACTIVE,
    })
    await Promise.all(
      churches.map(async (church) => {
        const recurringPayments = await this.recurringRepository.many(
          { churchId: church.getChurchId(), status: "ACTIVE" },
          { sort: [Order.asc("dayOfMonth"), Order.asc("name")] }
        )
        if (recurringPayments.length === 0) return

        const memberIds = await this.treasurerMemberIds(church.getChurchId())
        if (memberIds.length === 0) return

        for (const offset of REMINDER_OFFSETS) {
          const reminderDate = addDays(today, offset)
          const competence = reminderDate.slice(0, 7)
          const dueRecords =
            await this.financialRecordRepository.listRecurringPaymentsForChurch(
              church.getChurchId(),
              competence
            )
          const paidIds = new Set(
            dueRecords
              // The list returns every record of the competence, including
              // VOID. A voided record is a cancelled payment, so its competence
              // is unpaid again and must be reminded.
              .filter((record) => record.isSettled())
              .map((record) => record.getRecurringPaymentId())
              .filter((id): id is string => Boolean(id))
          )
          for (const payment of recurringPayments) {
            if (
              dueDateForCompetence(payment.getDayOfMonth(), competence) !==
              reminderDate
            )
              continue
            if (paidIds.has(payment.getRecurringPaymentId())) continue
            const current = payment.getCurrentPayment()
            if (
              current?.competence === competence &&
              (current.status === "PROCESSING" || current.status === "BLOCKED")
            )
              continue

            const lockKey = `recurring-payment-reminder:${payment.getRecurringPaymentId()}:${competence}:${offset}`
            if (await this.cacheService.get<boolean>(lockKey)) continue
            const message = reminderText(
              church.getLang(),
              payment.getName(),
              offset
            )
            this.queueService.dispatch<NotificationRequest>(
              QueueName.NotifyFCMJob,
              {
                churchId: church.getChurchId(),
                memberId: memberIds,
                title: message.title,
                body: message.body,
                data: {
                  type: NotificationsTopic.RECURRING_PAYMENT_DUE,
                  id: payment.getRecurringPaymentId(),
                },
              },
              {
                jobId: `recurring-reminder-${payment.getRecurringPaymentId()}-${competence}-${offset}`,
              }
            )
            await this.cacheService.set(lockKey, true, 60 * 60 * 48)
          }
        }
      })
    )
    this.logger.info("Finished recurring payment reminder scan", {
      date: today,
    })
  }

  private async treasurerMemberIds(churchId: string): Promise<string[]> {
    const userIds = await this.userAssignmentRepository.findUserIdsByRole(
      churchId,
      "TREASURER"
    )
    return this.userRepository.findMemberIdsByUserIds(churchId, userIds)
  }
}

function addDays(date: string, days: number): string {
  const result = new Date(`${date}T00:00:00.000Z`)
  result.setUTCDate(result.getUTCDate() + days)
  return result.toISOString().slice(0, 10)
}

function reminderText(
  lang: string,
  name: string,
  days: number
): { title: string; body: string } {
  if (lang.toLowerCase().startsWith("es")) {
    return {
      title: "Pago recurrente próximo",
      body:
        days === 0 ? `${name} vence hoy.` : `${name} vence en ${days} días.`,
    }
  }
  return {
    title: "Pagamento recorrente próximo",
    body: days === 0 ? `${name} vence hoje.` : `${name} vence em ${days} dias.`,
  }
}
