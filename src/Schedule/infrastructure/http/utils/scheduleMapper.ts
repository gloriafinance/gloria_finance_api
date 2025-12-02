import { ScheduleItem } from "@/Schedule/domain"

export const mapToConfigDTO = (scheduleItem: ScheduleItem) => ({
  scheduleItemId: scheduleItem.getScheduleItemId(),
  churchId: scheduleItem.getChurchId(),
  type: scheduleItem.getType(),
  title: scheduleItem.getTitle(),
  description: scheduleItem.getDescription(),
  location: scheduleItem.getLocation().toPrimitives(),
  recurrencePattern: scheduleItem.getRecurrencePattern().toPrimitives(),
  visibility: scheduleItem.getVisibility(),
  isActive: scheduleItem.getIsActive(),
  createdAt: scheduleItem.getCreatedAt(),
  createdByUserId: scheduleItem.getCreatedByUserId(),
  updatedAt: scheduleItem.getUpdatedAt(),
  updatedByUserId: scheduleItem.getUpdatedByUserId(),
})
