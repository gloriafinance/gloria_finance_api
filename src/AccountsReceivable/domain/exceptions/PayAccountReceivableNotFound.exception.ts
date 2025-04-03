import { DomainException } from "@/Shared/domain"

export class PayAccountReceivableNotFound extends DomainException {
  name = "ACCOUNT_RECEIVABLE_NOT_FOUND"
  message = "Account receivable not found"
}
