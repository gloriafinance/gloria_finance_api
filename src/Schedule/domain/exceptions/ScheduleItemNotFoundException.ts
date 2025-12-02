import { DomainException } from "@/Shared/domain"

export class ScheduleItemNotFoundException extends DomainException {
  constructor(message = "Schedule item not found") {
    super()
    this.message = message
    this.name = "schedule_item_not_found"
  }
}
