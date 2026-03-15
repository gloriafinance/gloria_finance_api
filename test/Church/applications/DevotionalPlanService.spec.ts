import { DevotionalPlanService } from "@/Church/applications/devotional/services/DevotionalPlanService"
import {
  Church,
  ChurchStatus,
  DevotionalAudience,
  DevotionalPlanMode,
  type IDevotionalDateService,
  type IDevotionalRepository,
  type IDevotionalWeeklyPlanRepository,
} from "@/Church/domain"

const createChurch = (): Church =>
  Church.fromPrimitives({
    id: "church-db-id",
    churchId: "church-1",
    name: "Church",
    city: "City",
    address: "Address",
    street: "Street",
    number: "1",
    postalCode: "00000",
    registerNumber: "",
    email: "church@church.com",
    openingDate: new Date(),
    ministerId: "minister-1",
    lang: "pt-BR",
    country: "BR",
    timezone: "America/Sao_Paulo",
    status: ChurchStatus.ACTIVE,
    createdAt: new Date(),
  })

describe("DevotionalPlanService", () => {
  const planRepository = {
    upsert: jest.fn(),
    findByChurchAndWeek: jest.fn(),
    listEnabledByWeek: jest.fn(),
  } as unknown as jest.Mocked<IDevotionalWeeklyPlanRepository>

  const devotionalRepository = {
    upsert: jest.fn(),
    findByDevotionalId: jest.fn(),
    findByChurchAndWeek: jest.fn(),
    deleteByChurchWeekAndDays: jest.fn(),
    claimGeneration: jest.fn(),
  } as unknown as jest.Mocked<IDevotionalRepository>

  const devotionalDateService = {
    getWeekStartDateForTimezone: jest.fn(),
    getNextWeekStartDateForTimezone: jest.fn(),
    scheduleDateForDay: jest.fn(),
    scheduledAtFromDateAndTime: jest.fn(),
    nowInTimezone: jest.fn(),
  } as jest.Mocked<IDevotionalDateService>

  const church = createChurch()

  beforeEach(() => {
    jest.clearAllMocks()
    devotionalDateService.getWeekStartDateForTimezone.mockReturnValue(
      "2026-03-09"
    )
    devotionalDateService.getNextWeekStartDateForTimezone.mockReturnValue(
      "2026-03-16"
    )
    planRepository.findByChurchAndWeek.mockResolvedValue(undefined)
    devotionalRepository.findByChurchAndWeek.mockResolvedValue([])
  })

  it("allows configuring the next devotional week", async () => {
    const service = new DevotionalPlanService(
      planRepository,
      devotionalRepository,
      devotionalDateService
    )

    const response = await service.upsertWeeklyPlan({
      church,
      currentUserId: "user-1",
      weekStartDate: "2026-03-16",
      isEnabled: false,
      audience: DevotionalAudience.ALL,
      mode: DevotionalPlanMode.REVIEW,
    })

    expect(response.plan.getWeekStartDate()).toBe("2026-03-16")
    expect(planRepository.upsert).toHaveBeenCalledTimes(1)
  })

  it("rejects weeks outside the current and next windows", async () => {
    const service = new DevotionalPlanService(
      planRepository,
      devotionalRepository,
      devotionalDateService
    )

    await expect(
      service.upsertWeeklyPlan({
        church,
        currentUserId: "user-1",
        weekStartDate: "2026-03-23",
        isEnabled: false,
        audience: DevotionalAudience.ALL,
        mode: DevotionalPlanMode.REVIEW,
      })
    ).rejects.toMatchObject({
      message:
        "Only current or next week can be configured. Allowed weekStartDate values: 2026-03-09, 2026-03-16",
    })
  })
})
