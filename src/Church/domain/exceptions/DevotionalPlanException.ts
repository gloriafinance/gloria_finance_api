import { DomainException } from "@/Shared/domain"

export class DevotionalPlanException extends DomainException {
  name = "DEVOTIONAL_PLAN_ERROR"
  message: string

  constructor(message: string) {
    super()
    this.message = message
  }
}
