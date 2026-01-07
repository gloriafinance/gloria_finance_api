import {
  CreateScheduleItem,
  ListScheduleItemsConfig,
  ListWeeklyScheduleOccurrences,
} from "@/Schedule/application"
import {
  DayOfWeek,
  RecurrenceType,
  ScheduleEvent,
  ScheduleEventType,
  ScheduleEventVisibility,
} from "@/Schedule/domain"
import {
  CreateScheduleEventRequest,
  ListScheduleEventsFiltersRequest,
} from "@/Schedule/domain/requests/ScheduleItem.request"
import { IScheduleItemRepository } from "@/Schedule/domain/interfaces/ScheduleItemRepository.interface"
import { Criteria, Paginate } from "@abejarano/ts-mongodb-criteria"
import { Church } from "@/Church/domain/Church"
import { IChurchRepository } from "@/Church/domain/interfaces/ChurchRepository.interface"
import { ChurchStatus } from "@/Church/domain/enums/ChurchStatus.enum"
import { ChurchDTO } from "@/Church/domain"

class InMemoryScheduleItemRepository implements IScheduleItemRepository {
  public lastCriteria?: Criteria
  private items: ScheduleEvent[] = []

  async upsert(scheduleItem: ScheduleEvent): Promise<void> {
    const index = this.items.findIndex(
      (item) => item.getScheduleItemId() === scheduleItem.getScheduleItemId()
    )

    if (index >= 0) {
      this.items[index] = scheduleItem
    } else {
      this.items.push(scheduleItem)
    }
  }

  async one(filter: {
    churchId?: string
    scheduleItemId?: string
  }): Promise<ScheduleEvent | undefined> {
    return this.items.find((item) => {
      if (filter.churchId && item.getChurchId() !== filter.churchId) {
        return false
      }
      if (
        filter.scheduleItemId &&
        item.getScheduleItemId() !== filter.scheduleItemId
      ) {
        return false
      }
      return true
    })
  }

  async list(criteria: Criteria): Promise<Paginate<ScheduleEvent>> {
    this.lastCriteria = criteria
    return {
      count: this.items.length,
      nextPag: null,
      results: this.items,
    }
  }

  async findManyByChurch(
    churchId: string,
    filters?: any
  ): Promise<ScheduleEvent[]> {
    return this.items.filter((item) => {
      if (item.getChurchId() !== churchId) {
        return false
      }
      if (filters?.type && item.getType() !== filters.type) {
        return false
      }
      if (filters?.visibility && item.getVisibility() !== filters.visibility) {
        return false
      }
      if (
        filters?.isActive !== undefined &&
        item.getIsActive() !== filters.isActive
      ) {
        return false
      }
      return true
    })
  }

  getAll(): ScheduleEvent[] {
    return this.items
  }
}

class InMemoryChurchRepository implements IChurchRepository {
  constructor(private readonly church: Church) {}

  async findById(churchId: string): Promise<Church | undefined> {
    if (this.church.getChurchId() === churchId) {
      return this.church
    }
    return undefined
  }

  // The remaining methods are not required for these tests
  async upsert(): Promise<void> {
    throw new Error("Method not implemented.")
  }

  async list(): Promise<Paginate<ChurchDTO>> {
    throw new Error("Method not implemented.")
  }

  async listByDistrictId(): Promise<Church[]> {
    throw new Error("Method not implemented.")
  }

  async hasAnAssignedMinister(): Promise<[boolean, Church | undefined]> {
    throw new Error("Method not implemented.")
  }

  async withoutAssignedMinister(): Promise<Church[]> {
    throw new Error("Method not implemented.")
  }
}

const buildChurch = () =>
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
    status: ChurchStatus.ACTIVE,
    createdAt: new Date("2020-01-01T10:00:00Z"),
  })

describe("Schedule module", () => {
  it("restores schedule items from primitives using isActive flag and date normalization", () => {
    const scheduleItem = ScheduleEvent.fromPrimitives({
      id: "mongo-id",
      scheduleItemId: "event-1",
      churchId: "church-1",
      type: ScheduleEventType.SERVICE,
      title: "Morning Service",
      description: "Traditional services",
      location: { name: "Main Auditorium", address: "Street 1" },
      recurrencePattern: {
        type: RecurrenceType.WEEKLY,
        dayOfWeek: DayOfWeek.SUNDAY,
        time: "09:30",
        durationMinutes: 90,
        timezone: "America/Sao_Paulo",
        startDate: "2025-01-01",
        endDate: "2025-02-01",
      },
      visibility: ScheduleEventVisibility.PUBLIC,
      director: "John Doe",
      preacher: "Jane Smith",
      observations: "Arrive early",
      isActive: false,
      createdAt: "2024-12-01T10:00:00Z",
      createdByUserId: "user-1",
    })

    expect(scheduleItem.getIsActive()).toBe(false)
    expect(scheduleItem.getRecurrencePattern().startDate).toBeInstanceOf(Date)
    expect(scheduleItem.getRecurrencePattern().endDate).toBeInstanceOf(Date)
    expect(scheduleItem.getDirector()).toBe("John Doe")
    expect(scheduleItem.getPreacher()).toBe("Jane Smith")
    expect(scheduleItem.getObservations()).toBe("Arrive early")
  })

  it("creates schedule items normalizing recurrence dates and keeping them active", async () => {
    const church = buildChurch()
    const repo = new InMemoryScheduleItemRepository()
    const churchRepo = new InMemoryChurchRepository(church)

    const useCase = new CreateScheduleItem(repo, churchRepo)

    const request: CreateScheduleEventRequest = {
      churchId: church.getChurchId(),
      type: ScheduleEventType.SERVICE,
      title: " Domingo da Família ",
      description: "  Culto principal ",
      location: { name: "Templo Central", address: "Rua A" },
      recurrencePattern: {
        type: RecurrenceType.WEEKLY,
        dayOfWeek: DayOfWeek.SUNDAY,
        time: "10:00",
        durationMinutes: 120,
        timezone: "America/Sao_Paulo",
        startDate: "2025-02-02",
        endDate: "2025-02-23",
      } as any,
      visibility: ScheduleEventVisibility.PUBLIC,
      director: "Pr. Silva",
      preacher: "Maria",
      observations: "Trazer visitantes",
      currentUserId: "user-1",
    }

    const scheduleItem = await useCase.execute(request)

    expect(scheduleItem.getIsActive()).toBe(true)
    expect(scheduleItem.getRecurrencePattern().startDate).toBeInstanceOf(Date)
    expect(scheduleItem.getRecurrencePattern().endDate).toBeInstanceOf(Date)
    expect(scheduleItem.getDirector()).toBe("Pr. Silva")
    expect(scheduleItem.getPreacher()).toBe("Maria")
    expect(scheduleItem.getObservations()).toBe("Trazer visitantes")
    expect(repo.getAll()).toHaveLength(1)
  })

  it("builds criteria filtering by isActive even when false", async () => {
    const repo = new InMemoryScheduleItemRepository()
    const useCase = new ListScheduleItemsConfig(repo)

    const filters: ListScheduleEventsFiltersRequest = {
      churchId: "church-1",
      page: 1,
      perPage: 10,
      isActive: false,
    }

    await useCase.execute(filters)

    expect(repo.lastCriteria).toBeDefined()
    const hasIsActiveFilter = repo.lastCriteria?.filters.filters.some(
      (filter: any) =>
        filter.field.value === "isActive" && filter.value.value === false
    )
    expect(hasIsActiveFilter).toBe(true)
  })

  it("expands occurrences within the requested week and respects visibility scope", async () => {
    const repo = new InMemoryScheduleItemRepository()

    const mondayPublic = ScheduleEvent.create({
      churchId: "church-1",
      type: ScheduleEventType.SERVICE,
      title: "Segunda oração",
      description: "",
      location: { name: "Sede", address: "Rua A" },
      recurrencePattern: {
        type: RecurrenceType.WEEKLY,
        dayOfWeek: DayOfWeek.MONDAY,
        time: "19:00",
        durationMinutes: 90,
        timezone: "America/Sao_Paulo",
        startDate: new Date("2025-01-01T00:00:00Z"),
      },
      visibility: ScheduleEventVisibility.PUBLIC,
      director: "Director A",
      preacher: "Preacher A",
      observations: "Obs A",
      createdByUserId: "user-1",
    })
    const wednesdayInternal = ScheduleEvent.create({
      churchId: "church-1",
      type: ScheduleEventType.MINISTRY_MEETING,
      title: "Reunião de líderes",
      description: "",
      location: { name: "Sala 2" },
      recurrencePattern: {
        type: RecurrenceType.WEEKLY,
        dayOfWeek: DayOfWeek.WEDNESDAY,
        time: "20:00",
        durationMinutes: 60,
        timezone: "America/Sao_Paulo",
        startDate: new Date("2025-01-01T00:00:00Z"),
      },
      visibility: ScheduleEventVisibility.INTERNAL_LEADERS,
      director: "Director B",
      preacher: undefined,
      observations: undefined,
      createdByUserId: "user-1",
    })
    const futureSeries = ScheduleEvent.create({
      churchId: "church-1",
      type: ScheduleEventType.REGULAR_EVENT,
      title: "Série especial",
      description: "",
      location: { name: "Anexo" },
      recurrencePattern: {
        type: RecurrenceType.WEEKLY,
        dayOfWeek: DayOfWeek.MONDAY,
        time: "18:00",
        durationMinutes: 60,
        timezone: "America/Sao_Paulo",
        startDate: new Date("2025-05-01T00:00:00Z"),
      },
      visibility: ScheduleEventVisibility.PUBLIC,
      director: "Director C",
      preacher: "Preacher C",
      observations: "Obs C",
      createdByUserId: "user-1",
    })

    expect(mondayPublic.getIsActive()).toBe(true)
    expect(wednesdayInternal.getIsActive()).toBe(true)
    expect(futureSeries.getIsActive()).toBe(true)
    ;(mondayPublic as any).scheduleItemId = "monday-public"
    ;(wednesdayInternal as any).scheduleItemId = "wednesday-internal"
    ;(futureSeries as any).scheduleItemId = "future-series"

    await repo.upsert(mondayPublic)
    await repo.upsert(wednesdayInternal)
    await repo.upsert(futureSeries)

    const useCase = new ListWeeklyScheduleOccurrences(repo)

    const scopedItems = await repo.findManyByChurch("church-1", {
      isActive: true,
    })
    expect(scopedItems).toHaveLength(3)

    const publicOccurrences = await useCase.execute({
      churchId: "church-1",
      weekStartDate: "2025-02-23",
      visibilityScope: ScheduleEventVisibility.PUBLIC,
    })

    expect(publicOccurrences).toHaveLength(1)
    expect(publicOccurrences[0].scheduleItemId).toBe(
      mondayPublic.getScheduleItemId()
    )
    expect(publicOccurrences[0].date).toBe("2025-02-24")
    expect(publicOccurrences[0].endTime).toBe("20:30")

    const leaderOccurrences = await useCase.execute({
      churchId: "church-1",
      weekStartDate: "2025-02-23",
      visibilityScope: ScheduleEventVisibility.INTERNAL_LEADERS,
    })

    expect(leaderOccurrences).toHaveLength(2)
    const ids = leaderOccurrences.map((occ) => occ.scheduleItemId)
    expect(ids).toContain(mondayPublic.getScheduleItemId())
    expect(ids).toContain(wednesdayInternal.getScheduleItemId())
  })
})
