import { DomainException } from "@/Shared/domain"

export class DevotionalNotFound extends DomainException {
  name = "DEVOTIONAL_NOT_FOUND"
  message = "Devotional not found"
}
