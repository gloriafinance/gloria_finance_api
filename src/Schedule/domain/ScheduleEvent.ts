import { DateBR, StringToDate } from "@/Shared/helpers"
import { AggregateRoot } from "@abejarano/ts-mongodb-criteria"

import {
  type LocationDTO,
  type RecurrencePatternDTO,
  ScheduleEventStatus,
  ScheduleEventType,
  ScheduleEventVisibility,
} from "@/Schedule/domain"
import { IdentifyEntity } from "@/Shared/adapter"

type UpdateDetailsParams = {
  title: string
  description?: string
  location: LocationDTO
  visibility: ScheduleEventVisibility
  director: string
  preacher?: string
  observations?: string
  updatedByUserId?: string
}

export class ScheduleEvent extends AggregateRoot {
  private scheduleItemId: string
  private churchId: string
  private type: ScheduleEventType
  private title: string
  private description?: string
  private location: {
    name: string
    address?: string
  }
  private recurrencePattern: RecurrencePatternDTO
  private visibility: ScheduleEventVisibility
  private director: string
  private preacher: string
  private observations?: string
  private status: ScheduleEventStatus
  private createdAt: Date
  private createdByUserId: string
  private updatedAt?: Date
  private updatedByUserId?: string

  static create(params: {
    churchId: string
    type: ScheduleEventType
    title: string
    description?: string
    location: {
      name: string
      address?: string
    }
    recurrencePattern: RecurrencePatternDTO
    visibility: ScheduleEventVisibility
    director: string
    preacher: string
    observations?: string
    createdByUserId: string
    createdAt?: Date
  }): ScheduleEvent {
    const title = params.title?.trim()

    const scheduleItem = new ScheduleEvent()
    scheduleItem.scheduleItemId = IdentifyEntity.get("schedule")
    scheduleItem.churchId = params.churchId
    scheduleItem.type = params.type
    scheduleItem.title = title
    scheduleItem.description = params.description?.trim()
    scheduleItem.location = params.location
    scheduleItem.recurrencePattern = ScheduleEvent.normalizeRecurrencePattern(
      params.recurrencePattern
    )
    scheduleItem.visibility = params.visibility
    scheduleItem.director = params.director.trim()
    scheduleItem.preacher = params.preacher.trim()
    scheduleItem.observations = params.observations?.trim()
    scheduleItem.status = ScheduleEventStatus.ACTIVE
    scheduleItem.createdAt = params.createdAt ?? DateBR()
    scheduleItem.createdByUserId = params.createdByUserId

    return scheduleItem
  }

  static fromPrimitives(plainData: any): ScheduleEvent {
    const scheduleItem = new ScheduleEvent()
    scheduleItem.scheduleItemId = plainData.scheduleItemId
    scheduleItem.churchId = plainData.churchId
    scheduleItem.type = plainData.type
    scheduleItem.title = plainData.title
    scheduleItem.description = plainData.description
    scheduleItem.location = plainData.location
    scheduleItem.recurrencePattern = ScheduleEvent.normalizeRecurrencePattern(
      plainData.recurrencePattern
    )
    scheduleItem.visibility = plainData.visibility
    scheduleItem.director = plainData.director ?? ""
    scheduleItem.preacher = plainData.preacher
    scheduleItem.observations = plainData.observations
    scheduleItem.status = plainData.status
    scheduleItem.createdAt = StringToDate(plainData.createdAt)
    scheduleItem.createdByUserId = plainData.createdByUserId
    scheduleItem.updatedAt = plainData.updatedAt
      ? StringToDate(plainData.updatedAt)
      : undefined
    scheduleItem.updatedByUserId = plainData.updatedByUserId
    return scheduleItem
  }

  private static normalizeRecurrencePattern(
    recurrencePattern: RecurrencePatternDTO
  ): RecurrencePatternDTO {
    return {
      ...recurrencePattern,
      startDate: StringToDate(recurrencePattern.startDate),
      endDate:
        recurrencePattern.endDate !== undefined &&
        recurrencePattern.endDate !== null
          ? StringToDate(recurrencePattern.endDate)
          : (recurrencePattern.endDate ?? undefined),
    }
  }

  updateDetails(params: UpdateDetailsParams): void {
    this.title = params.title?.trim()
    this.description = params.description?.trim()
    this.location = params.location
    this.visibility = params.visibility
    this.director = params.director.trim()
    this.preacher = params.preacher?.trim() ?? ""
    this.observations = params.observations?.trim()
    this.touch(params.updatedByUserId)
  }

  updateRecurrence(
    recurrencePattern: RecurrencePatternDTO,
    updatedByUserId?: string
  ): void {
    this.recurrencePattern =
      ScheduleEvent.normalizeRecurrencePattern(recurrencePattern)
    this.touch(updatedByUserId)
  }

  suspend(updatedByUserId?: string): void {
    this.status = ScheduleEventStatus.SUSPENDED
    this.touch(updatedByUserId)
  }

  finalize(updatedByUserId?: string): void {
    this.status = ScheduleEventStatus.FINALIZED
    this.touch(updatedByUserId)
  }

  activate(updatedByUserId?: string): void {
    this.status = ScheduleEventStatus.ACTIVE
    this.touch(updatedByUserId)
  }

  getScheduleItemId(): string {
    return this.scheduleItemId
  }

  getChurchId(): string {
    return this.churchId
  }

  getType(): ScheduleEventType {
    return this.type
  }

  getTitle(): string {
    return this.title
  }

  getDescription(): string | undefined {
    return this.description
  }

  getLocation(): LocationDTO {
    return this.location
  }

  getRecurrencePattern(): RecurrencePatternDTO {
    return this.recurrencePattern
  }

  getVisibility(): ScheduleEventVisibility {
    return this.visibility
  }

  getDirector(): string {
    return this.director
  }

  getPreacher(): string | undefined {
    return this.preacher
  }

  getObservations(): string | undefined {
    return this.observations
  }

  getStatus(): ScheduleEventStatus {
    return this.status
  }

  getCreatedAt(): Date {
    return this.createdAt
  }

  getCreatedByUserId(): string {
    return this.createdByUserId
  }

  getUpdatedAt(): Date | undefined {
    return this.updatedAt
  }

  getUpdatedByUserId(): string | undefined {
    return this.updatedByUserId
  }

  toPrimitives() {
    return {
      scheduleItemId: this.scheduleItemId,
      churchId: this.churchId,
      type: this.type,
      title: this.title,
      description: this.description,
      location: this.location,
      recurrencePattern: this.recurrencePattern,
      visibility: this.visibility,
      director: this.director,
      preacher: this.preacher,
      observations: this.observations,
      status: this.status,
      createdAt: this.createdAt,
      createdByUserId: this.createdByUserId,
      updatedAt: this.updatedAt,
      updatedByUserId: this.updatedByUserId,
    }
  }

  private touch(updatedByUserId?: string): void {
    if (updatedByUserId) {
      this.updatedByUserId = updatedByUserId
    }
    this.updatedAt = DateBR()
  }
}
