import type { IRecurringPaymentsRepository } from "@/Financial/domain/interfaces/RecurringPaymentsRepository.interface"
import type {
  CurrentRecurringPayment,
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
import type { FinanceRecord } from "@/Financial/domain/FinanceRecord"
import type { FinancialRecordStatus } from "@/Financial/domain/enums/FinancialRecordType.enum"

export type RecurringPaymentCompetenceStatus =
  | "PENDING"
  | "UPCOMING"
  | "PROCESSING"
  | "BLOCKED"
  | "FAILED"
  | "PAID"
  | "INACTIVE"

export type RecurringPaymentExecutionSummary = Pick<
  CurrentRecurringPayment,
  | "competence"
  | "externalReference"
  | "amount"
  | "paymentMethod"
  | "status"
  | "identificationField"
  | "paymentDate"
  | "transactionReceiptUrl"
  | "updatedAt"
>

/**
 * The settled accounting entry that makes a competence PAID. It belongs to the
 * financial record (the real history), so the competence response only exposes
 * the summary the screen needs to explain how it was paid.
 */
export type RecurringPaymentSettlement = {
  financialRecordId: string
  amount: number
  date: Date | string
  /** CLEARED for a manual registration, RECONCILED for a bank execution. */
  status: FinancialRecordStatus
  availabilityAccountId: string
  voucher?: string
}

/**
 * Flat on purpose: the OpenAPI example analyzer pairs a property with the wrong
 * member of an intersection, so the published example described
 * `competenceStatus` as a settlement and `settlement` as a string. The type
 * assertion below keeps every configuration field present without intersecting.
 */
export type RecurringPaymentForCompetence = {
  recurringPaymentId: string
  churchId: string
  financialConceptId: string
  costCenterId: string
  name: string
  type: RecurringPaymentConfigurationData["type"]
  amount?: number
  dayOfMonth: number
  pixDestination?: RecurringPaymentConfigurationData["pixDestination"]
  status: RecurringPaymentConfigurationData["status"]
  competence: string
  competenceStatus: RecurringPaymentCompetenceStatus
  /**
   * Execution state of THIS competence, when one was started. Without it the
   * screen would only know that something is PROCESSING/BLOCKED/FAILED, not the
   * amount, the method, the reference or when it was last updated.
   */
  currentPayment?: RecurringPaymentExecutionSummary
  /** Present only when the competence is PAID. */
  settlement?: RecurringPaymentSettlement
}

/** Compile-time guard: a competence row always carries the whole configuration. */
const _competenceRowKeepsConfiguration: RecurringPaymentForCompetence extends RecurringPaymentConfigurationData
  ? true
  : never = true
void _competenceRowKeepsConfiguration

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

    // The record itself is kept, not just its id: PAID has to be able to explain
    // the date, the amount, the origin account and the voucher, and those live in
    // the settlement. A competence can accumulate more than one record over time
    // (a cancelled one plus the real one), so the most recent settled one wins.
    const settledByRecurrence = new Map<string, FinanceRecord>()
    for (const record of records) {
      if (!record.isSettled()) continue
      const recurringPaymentId = record.getRecurringPaymentId()
      if (!recurringPaymentId) continue

      const previous = settledByRecurrence.get(recurringPaymentId)
      if (
        !previous ||
        new Date(record.getDate()).getTime() >=
          new Date(previous.getDate()).getTime()
      ) {
        settledByRecurrence.set(recurringPaymentId, record)
      }
    }
    const settledIds = new Set(settledByRecurrence.keys())

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
        .map((payment) => {
          const currentPayment = payment.getCurrentPayment()
          const settlement = settledByRecurrence.get(
            payment.getRecurringPaymentId()
          )

          return {
            ...payment.toConfiguration(),
            competence,
            competenceStatus: this.competenceStatus(
              payment,
              competence,
              settledIds,
              today
            ),
            // Only the execution of the requested month is meaningful here; a
            // failed attempt from another competence must not be shown.
            ...(currentPayment && currentPayment.competence === competence
              ? {
                  currentPayment: {
                    competence: currentPayment.competence,
                    externalReference: currentPayment.externalReference,
                    amount: currentPayment.amount,
                    ...(currentPayment.paymentMethod
                      ? { paymentMethod: currentPayment.paymentMethod }
                      : {}),
                    status: currentPayment.status,
                    ...(currentPayment.identificationField
                      ? {
                          identificationField:
                            currentPayment.identificationField,
                        }
                      : {}),
                    ...(currentPayment.paymentDate
                      ? { paymentDate: currentPayment.paymentDate }
                      : {}),
                    ...(currentPayment.transactionReceiptUrl
                      ? {
                          transactionReceiptUrl:
                            currentPayment.transactionReceiptUrl,
                        }
                      : {}),
                    updatedAt: currentPayment.updatedAt,
                  },
                }
              : {}),
            ...(settlement
              ? { settlement: this.settlementOf(settlement) }
              : {}),
          }
        })
    )
  }

  private settlementOf(record: FinanceRecord): RecurringPaymentSettlement {
    const voucher = record.getVoucher()

    return {
      financialRecordId: record.getFinancialRecordId(),
      amount: record.getAmount(),
      date: record.getDate(),
      status: record.getStatus(),
      availabilityAccountId: record.getAvailabilityAccountId(),
      ...(voucher ? { voucher } : {}),
    }
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
