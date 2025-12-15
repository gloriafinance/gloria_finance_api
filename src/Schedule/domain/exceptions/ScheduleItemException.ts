import { DomainException } from "@/Shared/domain"

export class ScheduleItemException extends DomainException {
  message: string
  name = "SCHEDULE_ITEM_ERROR"

  constructor(message: string) {
    super()
    this.message = message
  }
}
