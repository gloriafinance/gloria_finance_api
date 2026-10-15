import { DomainException } from "@/Shared/domain"

export type RecurringPaymentErrorCode =
  | "RECURRING_PAYMENT_NOT_FOUND"
  | "RECURRING_PAYMENT_INVALID"
  | "RECURRING_PAYMENT_FINANCIAL_CONCEPT_INVALID"
  | "RECURRING_PAYMENT_COST_CENTER_INVALID"
  | "RECURRING_PAYMENT_IN_PROGRESS"
  | "RECURRING_PAYMENT_BANK_ACCOUNT_UNAVAILABLE"
  | "RECURRING_PAYMENT_AMOUNT_REQUIRED"
  | "RECURRING_PAYMENT_AMOUNT_FORBIDDEN"
  | "RECURRING_PAYMENT_BILL_CODE_REQUIRED"
  | "RECURRING_PAYMENT_DAY_OF_MONTH_INVALID"
  | "RECURRING_PAYMENT_FIXED_AMOUNT_REQUIRED"
  | "RECURRING_PAYMENT_VARIABLE_AMOUNT_FORBIDDEN"
  | "RECURRING_PAYMENT_PIX_KEY_REQUIRED"
  | "RECURRING_PAYMENT_BANKING_REFERENCE_MISMATCH"
  | "RECURRING_PAYMENT_AVAILABILITY_ACCOUNT_UNAVAILABLE"
  | "RECURRING_PAYMENT_VOUCHER_REQUIRED"
  | "RECURRING_PAYMENT_MANUAL_NOT_ALLOWED"
  | "RECURRING_PAYMENT_BILL_AMOUNT_MISMATCH"

const messages: Record<RecurringPaymentErrorCode, string> = {
  RECURRING_PAYMENT_NOT_FOUND: "Recurring payment not found",
  RECURRING_PAYMENT_INVALID: "Recurring payment is invalid",
  RECURRING_PAYMENT_FINANCIAL_CONCEPT_INVALID:
    "Financial concept is unavailable for this church",
  RECURRING_PAYMENT_COST_CENTER_INVALID:
    "Cost center is unavailable for this church",
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
    "A PIX destination requires a non-empty key and a valid key type",
  RECURRING_PAYMENT_BANKING_REFERENCE_MISMATCH:
    "Banking event does not match the active recurring payment",
  RECURRING_PAYMENT_AVAILABILITY_ACCOUNT_UNAVAILABLE:
    "The availability account is not usable for this church",
  RECURRING_PAYMENT_VOUCHER_REQUIRED:
    "A voucher file is required to register a manual payment",
  RECURRING_PAYMENT_MANUAL_NOT_ALLOWED:
    "This church executes its recurring payments through the bank, so a manual registration is not allowed",
  RECURRING_PAYMENT_BILL_AMOUNT_MISMATCH:
    "The bill amount differs from the amount recorded for this recurrence",
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
