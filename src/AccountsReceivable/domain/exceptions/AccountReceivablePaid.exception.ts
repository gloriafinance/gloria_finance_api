import { DomainException } from "@/Shared/domain"

export class AccountReceivablePaid extends DomainException {
  name = "ACCOUNT_RECEIVABLE_PAID"
  message = "Paid account receivable"
}
