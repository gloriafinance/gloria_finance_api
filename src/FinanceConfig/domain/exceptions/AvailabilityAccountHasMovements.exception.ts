import { DomainException } from "@/Shared/domain"

export class AvailabilityAccountHasMovements extends DomainException {
  name = "AVAILABILITY_ACCOUNT_HAS_MOVEMENTS"
  message = "Availability account has associated movements"

  constructor(availabilityAccountId: string) {
    super()
    this.message = `Availability account ${availabilityAccountId} has associated movements`
  }
}
