import { DomainException } from "@/Shared/domain"

export type RecurringPaymentErrorCode =
  | "RECURRING_PAYMENT_NOT_FOUND"
  | "RECURRING_PAYMENT_INVALID"
  | "RECURRING_PAYMENT_FINANCIAL_CONCEPT_INVALID"
  | "RECURRING_PAYMENT_ALREADY_PAID"
  | "RECURRING_PAYMENT_IN_PROGRESS"
  | "RECURRING_PAYMENT_BANK_ACCOUNT_UNAVAILABLE"
  | "RECURRING_PAYMENT_AMOUNT_REQUIRED"
  | "RECURRING_PAYMENT_AMOUNT_FORBIDDEN"
  | "RECURRING_PAYMENT_BILL_CODE_REQUIRED"
  | "RECURRING_PAYMENT_DAY_OF_MONTH_INVALID"
  | "RECURRING_PAYMENT_FIXED_AMOUNT_REQUIRED"
  | "RECURRING_PAYMENT_VARIABLE_AMOUNT_FORBIDDEN"
  | "RECURRING_PAYMENT_PIX_KEY_REQUIRED"
  | "RECURRING_PAYMENT_BILL_CANNOT_HAVE_PIX_KEY"
  | "RECURRING_PAYMENT_BANKING_REFERENCE_MISMATCH"
  | "RECURRING_PAYMENT_CONFIGURATION_INVALID"

const messages: Record<RecurringPaymentErrorCode, string> = {
  RECURRING_PAYMENT_NOT_FOUND: "Recurring payment not found",
  RECURRING_PAYMENT_INVALID: "Recurring payment configuration is invalid",
  RECURRING_PAYMENT_FINANCIAL_CONCEPT_INVALID:
    "Financial concept is unavailable for this church",
  RECURRING_PAYMENT_ALREADY_PAID: "This competence has already been paid",
  RECURRING_PAYMENT_IN_PROGRESS:
    "A payment for this recurring payment is already in progress",
  RECURRING_PAYMENT_BANK_ACCOUNT_UNAVAILABLE:
    "No active church banking account is available for recurring payments",
  RECURRING_PAYMENT_AMOUNT_REQUIRED:
    "A valid amount is required for this payment",
  RECURRING_PAYMENT_AMOUNT_FORBIDDEN:
    "An amount must not be supplied for a fixed recurring payment",
  RECURRING_PAYMENT_BILL_CODE_REQUIRED:
    "A bill identification field is required",
  RECURRING_PAYMENT_DAY_OF_MONTH_INVALID:
    "Day of month must be between 1 and 31",
  RECURRING_PAYMENT_FIXED_AMOUNT_REQUIRED:
    "A fixed recurring payment requires an amount greater than zero",
  RECURRING_PAYMENT_VARIABLE_AMOUNT_FORBIDDEN:
    "A variable recurring payment cannot have a permanent amount",
  RECURRING_PAYMENT_PIX_KEY_REQUIRED:
    "PIX recurring payments require a PIX key and type",
  RECURRING_PAYMENT_BILL_CANNOT_HAVE_PIX_KEY:
    "Bill recurring payments cannot have a PIX key",
  RECURRING_PAYMENT_BANKING_REFERENCE_MISMATCH:
    "Banking event does not match the active recurring payment",
  RECURRING_PAYMENT_CONFIGURATION_INVALID:
    "Recurring payment configuration is invalid",
}

export class RecurringPaymentException extends DomainException {
  readonly name: RecurringPaymentErrorCode
  readonly message: string

  constructor(code: RecurringPaymentErrorCode) {
    super()
    this.name = code
    this.message = messages[code]
  }
}
