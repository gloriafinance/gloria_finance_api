import { DomainException } from "@/Shared/domain"

export class ScheduleItemException extends DomainException {
  constructor(message: string, code = "schedule_item_error", data?: []) {
    super()
    this.message = message
    this.name = code
    this.data = data
  }
}
