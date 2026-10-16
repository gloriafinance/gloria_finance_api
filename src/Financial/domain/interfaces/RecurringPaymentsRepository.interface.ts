import type {
  IRepository,
  MongoTransaction,
} from "@abejarano/ts-mongodb-criteria"
import {
  RecurringPayments,
  type CurrentRecurringPayment,
} from "@/Financial/domain/RecurringPayments.ts"

export interface IRecurringPaymentsRepository extends IRepository<RecurringPayments> {
  /**
   * Reserves or updates the current payment, optionally inside a transaction so
   * the month that accepts it can be checked in the same unit of work.
   */
  saveIfCurrentPaymentMatches(
    recurringPayment: RecurringPayments,
    expected: CurrentRecurringPayment | undefined,
    transaction?: MongoTransaction
  ): Promise<boolean>
}
