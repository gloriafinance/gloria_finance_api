import { DomainException } from "@/Shared/domain"

export class AvailabilityAccountNotFound extends DomainException {
  name = "ACCOUNT_NOT_FOUND"
  message = "Account not found"
}
