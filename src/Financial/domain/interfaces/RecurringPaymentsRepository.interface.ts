import type { IRepository } from "@abejarano/ts-mongodb-criteria"
import {
  RecurringPayments,
  type CurrentRecurringPayment,
} from "@/Financial/domain/RecurringPayments.ts"

export interface IRecurringPaymentsRepository extends IRepository<RecurringPayments> {
  saveIfCurrentPaymentMatches(
    recurringPayment: RecurringPayments,
    expected: CurrentRecurringPayment | undefined
  ): Promise<boolean>
}
