import { DomainException } from "@/Shared/domain"

export class AvailabilityAccountChurchMismatch extends DomainException {
  name = "AVAILABILITY_ACCOUNT_CHURCH_MISMATCH"
  message = "Availability account does not belong to provided church"

  constructor(accountChurchId: string, expectedChurchId: string) {
    super()
    this.message = `Availability account belongs to church ${accountChurchId} but ${expectedChurchId} was provided`
  }
}
