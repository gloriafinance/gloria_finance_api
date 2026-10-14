import type {
  PixKeyType,
  RecurringPaymentConfiguration,
} from "@/Financial/domain/RecurringPayments"

export type RecurringPaymentConfigurationRequest = {
  name: string
  financialConceptId: string
  type: "FIXED" | "VARIABLE"
  amount?: number
  dayOfMonth: number
  payment:
    | { method: "PIX"; pixKey: string; pixKeyType: PixKeyType }
    | { method: "BILL" }
  status?: RecurringPaymentConfiguration["status"]
}

export type PayRecurringPaymentRequest = {
  competence: string
  amount?: number
  identificationField?: string
}
