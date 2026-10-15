import type { IRecurringPaymentsRepository } from "@/Financial/domain/interfaces/RecurringPaymentsRepository.interface"
import type {
  RecurringPaymentConfigurationData,
  RecurringPayments,
} from "@/Financial/domain/RecurringPayments"
import { Order } from "@abejarano/ts-mongodb-criteria"
import { ObjectId } from "mongodb"
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

/**
 * Creation competence of a recurrence, derived from its ObjectId.
 *
 * `upsert` assigns a fresh `ObjectId` on creation and `hydrate` exposes it via
 * `getId()`, so the document already carries its creation date. Deriving the
 * month from it avoids introducing a stored validity field.
 *
 * Returns `null` when there is no usable id, in which case no lower bound can be
 * proven and the recurrence must stay visible rather than silently disappear.
 */
export function createdCompetenceOf(id: string | undefined): string | null {
  if (!id || !ObjectId.isValid(id)) return null
  const timestamp = new ObjectId(id).getTimestamp()
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(timestamp)
  const part = (type: string) =>
    parts.find((value) => value.type === type)?.value
  return `${part("year")}-${part("month")}`
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

    return (
      payments
        // A recurrence cannot be pending in a month before it was created; that
        // would report a debt that never existed. The lower bound is the
        // creation month already embedded in the document id.
        .filter((payment) => {
          const created = createdCompetenceOf(payment.getId())
          return created === null || competence >= created
        })
        .map((payment) => ({
          ...payment.toConfiguration(),
          competence,
          competenceStatus: this.competenceStatus(
            payment,
            competence,
            settledIds,
            today
          ),
        }))
    )
  }

  private competenceStatus(
    payment: RecurringPayments,
    competence: string,
    settledIds: Set<string>,
    today: string
  ): RecurringPaymentCompetenceStatus {
    // History outranks configuration: a competence that has a settled record is
    // PAID even if the recurrence was deactivated afterwards. Deactivating
    // stops future commitments, it does not erase what was already paid. The
    // real history is the financial record itself.
    if (settledIds.has(payment.getRecurringPaymentId())) return "PAID"

    // Before the recurrence existed there was no commitment, but the month still
    // has to be readable; it simply has nothing paid, so it falls through to the
    // usual pending/upcoming decision rather than pretending to be inactive.
    if (payment.getStatus() !== "ACTIVE") return "INACTIVE"

    const currentStatus = payment.getPaymentStatusForCompetence(competence)
    if (currentStatus) return currentStatus

    const dueDate = dueDateForCompetence(payment.getDayOfMonth(), competence)
    return dueDate <= today ? "PENDING" : "UPCOMING"
  }
}
