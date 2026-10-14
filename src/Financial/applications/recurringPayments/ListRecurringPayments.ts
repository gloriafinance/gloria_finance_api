import type {
  IRecurringPaymentsRepository,
  RecurringPaymentConfigurationData,
  RecurringPayments,
} from "@/Financial/domain"
import { Order } from "@abejarano/ts-mongodb-criteria"
import {
  assertCompetence,
  dueDateForCompetence,
  saoPauloDate,
} from "./RecurringPaymentCompetence"
import type { IFinancialRecordRepository } from "@/Financial/domain/interfaces"

export type RecurringPaymentCompetenceStatus =
  | "PENDING"
  | "UPCOMING"
  | "PROCESSING"
  | "BLOCKED"
  | "FAILED"
  | "PAID"
  | "INACTIVE"

export type RecurringPaymentForCompetence =
  RecurringPaymentConfigurationData & {
    competence: string
    competenceStatus: RecurringPaymentCompetenceStatus
  }

export class ListRecurringPayments {
  constructor(
    private readonly recurringPaymentsRepository: IRecurringPaymentsRepository,
    private readonly financialRecordRepository: IFinancialRecordRepository
  ) {}

  async execute(
    churchId: string,
    competence: string
  ): Promise<RecurringPaymentForCompetence[]> {
    assertCompetence(competence)
    const [payments, records] = await Promise.all([
      this.recurringPaymentsRepository.many(
        { churchId },
        { sort: [Order.asc("dayOfMonth"), Order.asc("name")] }
      ),
      this.financialRecordRepository.listRecurringPaymentsForChurch(
        churchId,
        competence
      ),
    ])
    const paidIds = new Set(
      records
        .map((record) => record.getRecurringPaymentId())
        .filter((id): id is string => Boolean(id))
    )
    const today = saoPauloDate()

    return payments.map((payment) => {
      return {
        ...payment.toConfiguration(),
        competence,
        competenceStatus: this.competenceStatus(
          payment,
          competence,
          paidIds,
          today
        ),
      }
    })
  }

  private competenceStatus(
    payment: RecurringPayments,
    competence: string,
    paidIds: Set<string>,
    today: string
  ): RecurringPaymentCompetenceStatus {
    if (payment.getStatus() !== "ACTIVE") return "INACTIVE"
    if (paidIds.has(payment.getRecurringPaymentsId())) return "PAID"

    const currentStatus = payment.getPaymentStatusForCompetence(competence)
    if (currentStatus) return currentStatus

    const dueDate = dueDateForCompetence(payment.getDayOfMonth(), competence)
    return dueDate <= today ? "PENDING" : "UPCOMING"
  }
}
