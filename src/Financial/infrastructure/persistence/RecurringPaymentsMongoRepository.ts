import { MongoRepository } from "@abejarano/ts-mongodb-criteria"
import { RecurringPayments } from "@/Financial/domain/RecurringPayments.ts"
import type { IRecurringPaymentsRepository } from "@/Financial/domain/interfaces/RecurringPaymentsRepository.interface.ts"
import type { CurrentRecurringPayment } from "@/Financial/domain/RecurringPayments.ts"
import type { Collection } from "mongodb"

export class RecurringPaymentsMongoRepository
  extends MongoRepository<RecurringPayments>
  implements IRecurringPaymentsRepository
{
  private static instance: RecurringPaymentsMongoRepository

  private constructor() {
    super(RecurringPayments)
  }

  static getInstance(): RecurringPaymentsMongoRepository {
    if (!this.instance) this.instance = new RecurringPaymentsMongoRepository()
    return this.instance
  }

  async saveIfCurrentPaymentMatches(
    recurringPayment: RecurringPayments,
    expected: CurrentRecurringPayment | undefined
  ): Promise<boolean> {
    const collection = await this.collection()
    const currentPaymentFilter = expected
      ? {
          "currentPayment.competence": expected.competence,
          "currentPayment.attempt": expected.attempt,
          "currentPayment.externalReference": expected.externalReference,
          "currentPayment.status": expected.status,
          "currentPayment.updatedAt": expected.updatedAt,
        }
      : { currentPayment: { $exists: false } }
    const result = await collection.replaceOne(
      {
        recurringPaymentId: recurringPayment.getRecurringPaymentId(),
        churchId: recurringPayment.getChurchId(),
        ...currentPaymentFilter,
      },
      recurringPayment.toPrimitives()
    )
    return result.matchedCount === 1
  }

  protected async ensureIndexes(collection: Collection): Promise<void> {
    await collection.createIndex(
      { recurringPaymentId: 1 },
      { unique: true, name: "idx_recurring_payments_id_unique" }
    )
    await collection.createIndex(
      { churchId: 1, status: 1, dayOfMonth: 1 },
      { name: "idx_recurring_payments_church_status_due_day" }
    )
    await collection.createIndex(
      { "currentPayment.externalReference": 1 },
      {
        unique: true,
        sparse: true,
        name: "idx_recurring_payments_active_reference_unique",
      }
    )
  }
}
