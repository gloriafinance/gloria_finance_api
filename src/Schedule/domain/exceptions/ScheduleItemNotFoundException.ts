import { DomainException } from "@/Shared/domain"

export class ScheduleItemNotFoundException extends DomainException {
  message: string = "Schedule item not found"
  name: string = "SCHEDULE_ITEM_NOT_FOUND"
}
