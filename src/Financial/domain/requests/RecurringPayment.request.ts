import type {
  PixDestination,
  PixKeyType,
  RecurringPaymentConfiguration,
} from "@/Financial/domain/RecurringPayments"

/**
 * Permanent configuration. Deliberately has no payment method: PIX/BILL belongs
 * to a single execution. See ADR-001.
 */
export type RecurringPaymentConfigurationRequest = {
  name: string
  financialConceptId: string
  costCenterId: string
  type: "FIXED" | "VARIABLE"
  amount?: number
  dayOfMonth: number
  pixDestination?: PixDestination
  status?: RecurringPaymentConfiguration["status"]
}

export type PayRecurringPaymentMethod =
  | { type: "PIX"; pixKey: string; pixKeyType: PixKeyType }
  | { type: "BILL"; identificationField: string }

/**
 * Execution command. The method describes THIS operation and is never persisted
 * as permanent configuration.
 */
export type PayRecurringPaymentRequest = {
  competence: string
  amount?: number
  payment?: PayRecurringPaymentMethod
  availabilityAccountId?: string
}

/**
 * Manual execution (church without a connected Asaas account, or a commitment
 * paid outside the bank). The voucher is mandatory. See ADR-003 / ADR-005.
 */
export type RegisterRecurringPaymentRequest = {
  competence: string
  amount?: number
  paymentDate: string
  availabilityAccountId: string
}
