import { DevotionalDateDayjsService } from "@/Church/infrastructure/services/DevotionalDateDayjsService"

describe("DevotionalDateDayjsService", () => {
  it("keeps the provided calendar date when computing week start in the church timezone", () => {
    const service = DevotionalDateDayjsService.getInstance()

    expect(
      service.getWeekStartDateForTimezone(
        "America/Sao_Paulo",
        "2026-03-23"
      )
    ).toBe("2026-03-23")
  })

  it("maps sunday to the monday of the same devotional week", () => {
    const service = DevotionalDateDayjsService.getInstance()

    expect(
      service.getWeekStartDateForTimezone(
        "America/Sao_Paulo",
        "2026-03-22"
      )
    ).toBe("2026-03-16")
  })
})
