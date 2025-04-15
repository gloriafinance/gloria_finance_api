import { DomainException } from "@/Shared/domain"

export class AccountPayableNotFound extends DomainException {
  name = "ACCOUNT_PAYABLE_NOT_FOUND"
  message = "Account payable not found"
}
