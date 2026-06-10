import { Church, ChurchStatus, type IChurchRepository } from "@/Church/domain"
import { NotifyScheduleDay } from "@/Schedule/application/jobs/NotifyScheduleDay"
import {
  DayOfWeek,
  type IScheduleReminderService,
  RecurrenceType,
  ScheduleEvent,
  ScheduleEventStatus,
  ScheduleEventType,
  ScheduleEventVisibility,
  type IScheduleItemRepository,
} from "@/Schedule/domain"
import { type IQueueService, QueueName } from "@/package/queue/domain"
import { type Criteria, type Paginate } from "@abejarano/ts-mongodb-criteria"
import type { ICacheService } from "@/Shared/domain"

class InMemoryChurchRepository implements IChurchRepository {
  constructor(private readonly churches: Church[]) {}

  async all(_filter: object): Promise<Church[]> {
    return this.churches
  }

  async findById(_churchId: string): Promise<Church | undefined> {
    throw new Error("Method not implemented.")
  }

  async upsert(): Promise<void> {
    throw new Error("Method not implemented.")
  }

  async one(_filter: object): Promise<Church | null> {
    throw new Error("Method not implemented.")
  }

  async list<D>(
    _criteria: Criteria,
    _fieldsToExclude?: string[]
  ): Promise<Paginate<D>> {
    throw new Error("Method not implemented.")
  }

  async delete(_filter: object): Promise<void> {
    throw new Error("Method not implemented.")
  }

  async listByDistrictId(_districtId: string): Promise<Church[]> {
    throw new Error("Method not implemented.")
  }

  async hasAnAssignedMinister(
    _churchId: string
  ): Promise<[boolean, Church | undefined]> {
    throw new Error("Method not implemented.")
  }

  async withoutAssignedMinister(): Promise<Church[]> {
    throw new Error("Method not implemented.")
  }

  async getOrCreateMemberRegistrationToken(
    _churchId: string
  ): Promise<string> {
    throw new Error("Method not implemented.")
  }
}

class InMemoryScheduleRepository implements IScheduleItemRepository {
  constructor(private readonly items: ScheduleEvent[]) {}

  async upsert(scheduleItem: ScheduleEvent): Promise<void> {
    const index = this.items.findIndex(
      (item) => item.getScheduleItemId() === scheduleItem.getScheduleItemId()
    )

    if (index >= 0) {
      this.items[index] = scheduleItem
      return
    }

    this.items.push(scheduleItem)
  }

  async one(_filter: object): Promise<ScheduleEvent | null> {
    throw new Error("Method not implemented.")
  }

  async list<D>(
    _criteria: Criteria,
    _fieldsToExclude?: string[]
  ): Promise<Paginate<D>> {
    throw new Error("Method not implemented.")
  }

  async delete(_filter: object): Promise<void> {
    throw new Error("Method not implemented.")
  }

  async findManyByChurch(
    churchId: string,
    filters?: any
  ): Promise<ScheduleEvent[]> {
    return this.items.filter((item) => {
      if (item.getChurchId() !== churchId) {
        return false
      }

      if (
        filters?.isActive !== undefined &&
        (item.getStatus() === ScheduleEventStatus.ACTIVE) !== filters.isActive
      ) {
        return false
      }

      return true
    })
  }

  async findTodayByChurch(): Promise<ScheduleEvent | undefined> {
    throw new Error("Method not implemented.")
  }

  async deactivatePreviousDayEvents(): Promise<number> {
    throw new Error("Method not implemented.")
  }
}

const buildChurch = (timezone = "America/Sao_Paulo") =>
  Church.fromPrimitives({
    id: "mongo-church-id",
    churchId: "church-1",
    name: "Central Church",
    city: "Sao Paulo",
    address: "Street 1",
    street: "Street 1",
    number: "100",
    postalCode: "00000-000",
    registerNumber: "123456",
    email: "church@example.com",
    openingDate: new Date("2020-01-01"),
    ministerId: "minister-1",
    timezone,
    country: "BR",
    status: ChurchStatus.ACTIVE,
    createdAt: new Date("2020-01-01T10:00:00Z"),
  })

const buildScheduleEvent = (timezone = "America/Sao_Paulo") =>
  ScheduleEvent.fromPrimitives({
    id: "mongo-id",
    scheduleItemId: "event-1",
    churchId: "church-1",
    type: ScheduleEventType.SERVICE,
    title: "Culto de adoração e louvor",
    description: "Culto principal",
    location: { name: "Templo Central", address: "Rua A" },
    recurrencePattern: {
      type: RecurrenceType.WEEKLY,
      dayOfWeek: DayOfWeek.SUNDAY,
      time: "18:00",
      durationMinutes: 150,
      timezone,
      startDate: "2026-03-08T03:00:00.000Z",
      endDate: null,
    },
    visibility: ScheduleEventVisibility.PUBLIC,
    director: "Jonathan Jiménez",
    preacher: "Angel Bejarano",
    isActive: true,
    createdAt: "2026-02-11T10:00:00.000Z",
    createdByUserId: "user-1",
  })

describe("NotifyScheduleDay", () => {
  const queueService = {
    dispatch: jest.fn(),
  } as jest.Mocked<IQueueService>

  const scheduleReminderService = {
    shouldQueueReminder: jest.fn(),
    reminderDelayMs: jest.fn(),
    formatScheduledDateTime: jest.fn(),
    notificationDateKey: jest.fn(),
    isExpired: jest.fn(),
  } as jest.Mocked<IScheduleReminderService>

  const cacheService = {
    get: jest.fn(),
    set: jest.fn(),
    invalidate: jest.fn(),
    invalidateByPrefix: jest.fn(),
  } as jest.Mocked<ICacheService>

  beforeEach(() => {
    jest.clearAllMocks()
    scheduleReminderService.shouldQueueReminder.mockReturnValue(true)
    scheduleReminderService.reminderDelayMs.mockReturnValue(15_000)
    scheduleReminderService.formatScheduledDateTime.mockReturnValue(
      "3/15/2026, 6:00 PM"
    )
    scheduleReminderService.notificationDateKey.mockReturnValue("2026-03-15")
    scheduleReminderService.isExpired.mockReturnValue(false)
    cacheService.get.mockResolvedValue(null)
    cacheService.set.mockResolvedValue()
  })

  it("notifies once at 09:00 in the event timezone and uses the event time in the body", async () => {
    const churchRepository = new InMemoryChurchRepository([buildChurch()])
    const scheduleRepository = new InMemoryScheduleRepository([
      buildScheduleEvent(),
    ])

    const job = new NotifyScheduleDay(
      churchRepository,
      scheduleRepository,
      queueService,
      scheduleReminderService,
      cacheService
    )

    await job.handle({
      referenceDate: "2026-03-15T12:00:00.000Z",
    })

    expect(queueService.dispatch).toHaveBeenCalledTimes(1)
    expect(queueService.dispatch).toHaveBeenCalledWith(
      QueueName.NotifyFCMJob,
      expect.objectContaining({
        churchId: "church-1",
        title: "Schedule Day",
        body: "Culto de adoração e louvor at 3/15/2026, 6:00 PM",
      }),
      expect.objectContaining({
        delayMs: 15_000,
        jobId: "schedule-day:church-1:event-1:2026-03-15",
      })
    )
    expect(cacheService.set).toHaveBeenCalledWith(
      "schedule-day:queued:church-1:event-1:2026-03-15",
      true,
      172800
    )
  })

  it("uses the schedule recurrence timezone instead of the church timezone when deciding reminders", async () => {
    const churchRepository = new InMemoryChurchRepository([
      buildChurch("America/New_York"),
    ])
    const scheduleRepository = new InMemoryScheduleRepository([
      buildScheduleEvent("America/Sao_Paulo"),
    ])

    const job = new NotifyScheduleDay(
      churchRepository,
      scheduleRepository,
      queueService,
      scheduleReminderService,
      cacheService
    )

    await job.handle({
      referenceDate: "2026-03-18T11:59:00.000Z",
    })

    expect(scheduleReminderService.shouldQueueReminder).toHaveBeenCalledWith(
      expect.anything(),
      "America/Sao_Paulo",
      expect.any(Date),
      "15:30"
    )
    expect(scheduleReminderService.notificationDateKey).toHaveBeenCalledWith(
      expect.anything(),
      "America/Sao_Paulo",
      expect.any(Date)
    )
    expect(scheduleReminderService.reminderDelayMs).toHaveBeenCalledWith(
      "America/Sao_Paulo",
      expect.any(Date),
      "15:30"
    )
    expect(scheduleReminderService.isExpired).toHaveBeenCalledWith(
      expect.anything(),
      "America/Sao_Paulo",
      expect.any(Date)
    )
  })

  it("does not notify when the reminder service says the event is not due yet", async () => {
    const churchRepository = new InMemoryChurchRepository([
      buildChurch("America/New_York"),
    ])
    const scheduleRepository = new InMemoryScheduleRepository([
      buildScheduleEvent("America/New_York"),
    ])

    const job = new NotifyScheduleDay(
      churchRepository,
      scheduleRepository,
      queueService,
      scheduleReminderService,
      cacheService
    )

    scheduleReminderService.shouldQueueReminder.mockReturnValue(false)

    await job.handle({
      referenceDate: "2026-03-15T12:00:00.000Z",
    })

    expect(queueService.dispatch).not.toHaveBeenCalled()
  })

  it("does not queue the same daily reminder twice after a restart", async () => {
    const churchRepository = new InMemoryChurchRepository([buildChurch()])
    const scheduleRepository = new InMemoryScheduleRepository([
      buildScheduleEvent(),
    ])

    const job = new NotifyScheduleDay(
      churchRepository,
      scheduleRepository,
      queueService,
      scheduleReminderService,
      cacheService
    )

    cacheService.get.mockResolvedValue(true)

    await job.handle({
      referenceDate: "2026-03-15T12:00:00.000Z",
    })

    expect(queueService.dispatch).not.toHaveBeenCalled()
    expect(cacheService.set).not.toHaveBeenCalled()
  })
})
