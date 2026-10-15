import type { IRecurringPaymentsRepository } from "@/Financial/domain/interfaces/RecurringPaymentsRepository.interface"
import type {
  RecurringPaymentConfigurationData,
  RecurringPayments,
} from "@/Financial/domain/RecurringPayments"
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

    const settledIds = new Set(
      records
        .filter((record) => record.isSettled())
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
          settledIds,
          today
        ),
      }
    })
  }

  private competenceStatus(
    payment: RecurringPayments,
    competence: string,
    settledIds: Set<string>,
    today: string
  ): RecurringPaymentCompetenceStatus {
    if (payment.getStatus() !== "ACTIVE") return "INACTIVE"

    // A settled record is the only proof the money actually left the account.
    if (settledIds.has(payment.getRecurringPaymentId())) return "PAID"

    const currentStatus = payment.getPaymentStatusForCompetence(competence)
    if (currentStatus) return currentStatus

    const dueDate = dueDateForCompetence(payment.getDayOfMonth(), competence)
    return dueDate <= today ? "PENDING" : "UPCOMING"
  }
}
