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
  | { type: "PIX_QR"; payload: string }
  | { type: "BILL"; identificationField: string }

/**
 * Execution command. The method describes THIS operation and is never persisted
 * as permanent configuration.
 */
export type PayRecurringPaymentRequest = {
  /**
   * @description Mes al que corresponde el pago recurrente, en formato YYYY-MM.
   * Es la competencia contable/mensual de esa recurrencia, no la fecha del pago ni la fecha de vencimiento.
   * Ejemplo: una "Conta de Luz" con vencimiento día 20 pagada el 17/10/2026 lleva "2026-10".
   * Incluso si se paga atrasada (p. ej. Conta de setembro pagada el 05/10/2026), la competencia sigue siendo "2026-09".
   */
  competence: string
  amount?: number
  payment?: PayRecurringPaymentMethod
  availabilityAccountId?: string
}

export type PayRecurringPaymentPixQrRequest = {
  competence: string
  amount?: number
  payment: { type: "PIX_QR"; payload: string }
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
