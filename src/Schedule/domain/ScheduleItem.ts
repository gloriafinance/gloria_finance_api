import { AggregateRoot } from "@abejarano/ts-mongodb-criteria"
import { v4 as uuid } from "uuid"
import { DateBR } from "@/Shared/helpers"
import { Location, LocationPrimitives } from "./valueObjects/Location"
import {
  RecurrencePattern,
  RecurrencePatternPrimitives,
} from "./valueObjects/RecurrencePattern"
import {
  ScheduleItemType,
  ScheduleItemVisibility,
} from "./types/ScheduleItem.type"
import { ScheduleItemException } from "./exceptions/ScheduleItemException"

export type ScheduleItemPrimitives = {
  scheduleItemId: string
  churchId: string
  type: ScheduleItemType
  title: string
  description?: string
  location: LocationPrimitives
  recurrencePattern: RecurrencePatternPrimitives
  visibility: ScheduleItemVisibility
  isActive: boolean
  createdAt: Date
  createdByUserId: string
  updatedAt?: Date
  updatedByUserId?: string
}

type UpdateDetailsParams = {
  title: string
  description?: string
  location: Location
  visibility: ScheduleItemVisibility
  updatedByUserId?: string
}

export class ScheduleItem extends AggregateRoot {
  private id?: string
  private scheduleItemId: string
  private churchId: string
  private type: ScheduleItemType
  private title: string
  private description?: string
  private location: Location
  private recurrencePattern: RecurrencePattern
  private visibility: ScheduleItemVisibility
  private isActive: boolean
  private createdAt: Date
  private createdByUserId: string
  private updatedAt?: Date
  private updatedByUserId?: string

  getId(): string {
    return this.id
  }

  static create(params: {
    churchId: string
    type: ScheduleItemType
    title: string
    description?: string
    location: Location
    recurrencePattern: RecurrencePattern
    visibility: ScheduleItemVisibility
    createdByUserId: string
    createdAt?: Date
  }): ScheduleItem {
    if (!params.churchId) {
      throw new ScheduleItemException("churchId is required")
    }

    if (!params.createdByUserId) {
      throw new ScheduleItemException("createdByUserId is required")
    }

    const title = params.title?.trim()
    if (!title) {
      throw new ScheduleItemException("title is required")
    }

    const scheduleItem = new ScheduleItem()
    scheduleItem.scheduleItemId = uuid()
    scheduleItem.churchId = params.churchId
    scheduleItem.type = params.type
    scheduleItem.title = title
    scheduleItem.description = params.description?.trim()
    scheduleItem.location = params.location
    scheduleItem.recurrencePattern = params.recurrencePattern
    scheduleItem.visibility = params.visibility
    scheduleItem.isActive = true
    scheduleItem.createdAt = params.createdAt ?? DateBR()
    scheduleItem.createdByUserId = params.createdByUserId

    return scheduleItem
  }

  static fromPrimitives(plainData: any): ScheduleItem {
    const scheduleItem = new ScheduleItem()
    scheduleItem.id = plainData.id
    scheduleItem.scheduleItemId = plainData.scheduleItemId
    scheduleItem.churchId = plainData.churchId
    scheduleItem.type = plainData.type
    scheduleItem.title = plainData.title
    scheduleItem.description = plainData.description
    scheduleItem.location = Location.fromPrimitives(plainData.location)
    scheduleItem.recurrencePattern = RecurrencePattern.fromPrimitives(
      plainData.recurrencePattern
    )
    scheduleItem.visibility = plainData.visibility
    scheduleItem.isActive = plainData.isActive
    scheduleItem.createdAt = new Date(plainData.createdAt)
    scheduleItem.createdByUserId = plainData.createdByUserId
    scheduleItem.updatedAt = plainData.updatedAt
      ? new Date(plainData.updatedAt)
      : undefined
    scheduleItem.updatedByUserId = plainData.updatedByUserId
    return scheduleItem
  }

  updateDetails(params: UpdateDetailsParams): void {
    const title = params.title?.trim()
    if (!title) {
      throw new ScheduleItemException("title is required")
    }

    this.title = title
    this.description = params.description?.trim()
    this.location = params.location
    this.visibility = params.visibility
    this.touch(params.updatedByUserId)
  }

  updateRecurrence(
    recurrencePattern: RecurrencePattern,
    updatedByUserId?: string
  ): void {
    this.recurrencePattern = recurrencePattern
    this.touch(updatedByUserId)
  }

  deactivate(updatedByUserId?: string): void {
    this.isActive = false
    this.touch(updatedByUserId)
  }

  activate(updatedByUserId?: string): void {
    this.isActive = true
    this.touch(updatedByUserId)
  }

  getScheduleItemId(): string {
    return this.scheduleItemId
  }

  getChurchId(): string {
    return this.churchId
  }

  getType(): ScheduleItemType {
    return this.type
  }

  getTitle(): string {
    return this.title
  }

  getDescription(): string | undefined {
    return this.description
  }

  getLocation(): Location {
    return this.location
  }

  getRecurrencePattern(): RecurrencePattern {
    return this.recurrencePattern
  }

  getVisibility(): ScheduleItemVisibility {
    return this.visibility
  }

  getIsActive(): boolean {
    return this.isActive
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

  toPrimitives(): ScheduleItemPrimitives {
    return {
      scheduleItemId: this.scheduleItemId,
      churchId: this.churchId,
      type: this.type,
      title: this.title,
      description: this.description,
      location: this.location.toPrimitives(),
      recurrencePattern: this.recurrencePattern.toPrimitives(),
      visibility: this.visibility,
      isActive: this.isActive,
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
