import { ScheduleEvent } from "@/Schedule/domain"

export const mapToConfigDTO = (scheduleItem: ScheduleEvent) => ({
  scheduleItemId: scheduleItem.getScheduleItemId(),
  churchId: scheduleItem.getChurchId(),
  type: scheduleItem.getType(),
  title: scheduleItem.getTitle(),
  description: scheduleItem.getDescription(),
  location: scheduleItem.getLocation(),
  recurrencePattern: scheduleItem.getRecurrencePattern(),
  visibility: scheduleItem.getVisibility(),
  director: scheduleItem.getDirector(),
  preacher: scheduleItem.getPreacher(),
  observations: scheduleItem.getObservations(),
  isActive: scheduleItem.getIsActive(),
  createdAt: scheduleItem.getCreatedAt(),
  createdByUserId: scheduleItem.getCreatedByUserId(),
  updatedAt: scheduleItem.getUpdatedAt(),
  updatedByUserId: scheduleItem.getUpdatedByUserId(),
})
