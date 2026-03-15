jest.mock("@/Church/infrastructure", () => ({
  ChurchMongoRepository: { getInstance: jest.fn() },
  DevotionalDateDayjsService: { getInstance: jest.fn() },
  DevotionalDeliveryLogMongoRepository: { getInstance: jest.fn() },
  DevotionalMongoRepository: { getInstance: jest.fn() },
  DevotionalWeeklyPlanMongoRepository: { getInstance: jest.fn() },
  MemberMongoRepository: { getInstance: jest.fn() },
}))

jest.mock("@/Shared/infrastructure", () => ({
  PermissionMiddleware: jest.fn(),
  QueueService: { getInstance: jest.fn() },
}))

import { HttpStatus } from "@/Shared/domain"
import { Church, ChurchStatus, DevotionalPlanMode } from "@/Church/domain"
import { DevotionalPlanService } from "@/Church/applications/devotional/services/DevotionalPlanService"
import { DevotionalController } from "@/Church/infrastructure/http/controllers/Devotional.controller"
import {
  ChurchMongoRepository,
  DevotionalDateDayjsService,
  DevotionalMongoRepository,
  DevotionalWeeklyPlanMongoRepository,
} from "@/Church/infrastructure"
import { QueueService } from "@/Shared/infrastructure"

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

describe("DevotionalController", () => {
  const churchRepository = {
    one: jest.fn(),
  }
  const devotionalRepository = {
    findByChurchAndWeek: jest.fn(),
  }
  const queueService = {
    dispatch: jest.fn(),
  }
  const dateService = {
    getWeekStartDateForTimezone: jest.fn(),
  }

  const response = {
    status: jest.fn(),
    send: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()

    response.status.mockReturnValue(response)
    ;(ChurchMongoRepository.getInstance as jest.Mock).mockReturnValue(
      churchRepository
    )
    ;(DevotionalMongoRepository.getInstance as jest.Mock).mockReturnValue(
      devotionalRepository
    )
    ;(
      DevotionalWeeklyPlanMongoRepository.getInstance as jest.Mock
    ).mockReturnValue({})
    ;(DevotionalDateDayjsService.getInstance as jest.Mock).mockReturnValue(
      dateService
    )
    ;(QueueService.getInstance as jest.Mock).mockReturnValue(queueService)

    churchRepository.one.mockResolvedValue(createChurch())
    devotionalRepository.findByChurchAndWeek.mockResolvedValue([])
    dateService.getWeekStartDateForTimezone.mockReturnValue("2026-03-09")
  })

  it("uses the requested weekStartDate instead of forcing the current week", async () => {
    const upsertWeeklyPlanSpy = jest
      .spyOn(DevotionalPlanService.prototype, "upsertWeeklyPlan")
      .mockResolvedValue({
        plan: {
          getIsEnabled: () => false,
          toPrimitives: () => ({ weekStartDate: "2026-03-16" }),
        } as any,
      })

    const controller = new DevotionalController()

    await controller.upsertPlan(
      {
        weekStartDate: "2026-03-16",
        isEnabled: false,
        requiresPastorReview: true,
      } as any,
      {
        auth: {
          churchId: "church-1",
          userId: "user-1",
        },
      } as any,
      response as any
    )

    expect(upsertWeeklyPlanSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        weekStartDate: "2026-03-16",
        mode: DevotionalPlanMode.REVIEW,
      })
    )
    expect(response.status).toHaveBeenCalledWith(HttpStatus.ACCEPTED)
    expect(response.send).toHaveBeenCalledWith(
      expect.objectContaining({
        weekStartDate: "2026-03-16",
      })
    )

    upsertWeeklyPlanSpy.mockRestore()
  })
})
