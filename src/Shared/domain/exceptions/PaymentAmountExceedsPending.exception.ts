import { DomainException } from "./domain-exception"

export class PaymentAmountExceedsPending extends DomainException {
  name = "PAYMENT_AMOUNT_EXCEEDS_PENDING"
  message = "Payment amount exceeds the pending amount"
}
