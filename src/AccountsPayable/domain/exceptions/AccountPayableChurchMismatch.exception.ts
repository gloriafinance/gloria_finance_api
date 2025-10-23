import { DomainException } from "@/Shared/domain"

export class AccountPayableChurchMismatch extends DomainException {
  name = "ACCOUNT_PAYABLE_CHURCH_MISMATCH"
  message = "Account payable does not belong to provided church"

  constructor(accountChurchId: string, expectedChurchId: string) {
    super()
    this.message = `Account payable belongs to church ${accountChurchId} but ${expectedChurchId} was provided`
  }
}
