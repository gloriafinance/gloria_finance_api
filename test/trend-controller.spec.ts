// Mock uuid (manual mock in __mocks__ folder)
jest.mock("uuid")

// Mock dependencies to avoid loading heavy modules
jest.mock("@/Reports/applications", () => ({
  DRE: jest.fn(),
}))
jest.mock("@/Financial/infrastructure", () => ({
  FinanceRecordMongoRepository: { getInstance: jest.fn() },
}))
jest.mock("@/Reports/infrastructure/persistence/DREMongoRepository", () => ({
  DREMongoRepository: { getInstance: jest.fn() },
}))
jest.mock("@/Church/infrastructure", () => ({
  ChurchMongoRepository: { getInstance: jest.fn() },
}))

import { TrendController } from "@/Reports/infrastructure/http/controllers/Trend.controller"
import { BaseReportRequest } from "@/Reports/domain"

describe("TrendController - Previous Month Calculation", () => {
  describe("getPreviousMonthRequest", () => {
    it("should calculate previous month correctly for mid-year months", () => {
      const req: BaseReportRequest & { month: number } = {
        churchId: "church-001",
        year: 2025,
        month: 5,
      }

      // Access private method through reflection for testing
      const previousReq = (TrendController as any).getPreviousMonthRequest(req)

      expect(previousReq.year).toBe(2025)
      expect(previousReq.month).toBe(4)
      expect(previousReq.churchId).toBe("church-001")
    })

    it("should rollback to December of previous year when month is January", () => {
      const req: BaseReportRequest & { month: number } = {
        churchId: "church-001",
        year: 2025,
        month: 1,
      }

      const previousReq = (TrendController as any).getPreviousMonthRequest(req)

      expect(previousReq.year).toBe(2024)
      expect(previousReq.month).toBe(12)
      expect(previousReq.churchId).toBe("church-001")
    })

    it("should handle February correctly", () => {
      const req: BaseReportRequest & { month: number } = {
        churchId: "church-001",
        year: 2025,
        month: 2,
      }

      const previousReq = (TrendController as any).getPreviousMonthRequest(req)

      expect(previousReq.year).toBe(2025)
      expect(previousReq.month).toBe(1)
    })

    it("should handle December correctly (no year rollback)", () => {
      const req: BaseReportRequest & { month: number } = {
        churchId: "church-001",
        year: 2025,
        month: 12,
      }

      const previousReq = (TrendController as any).getPreviousMonthRequest(req)

      expect(previousReq.year).toBe(2025)
      expect(previousReq.month).toBe(11)
    })

    it("should preserve all other request properties", () => {
      const req: BaseReportRequest & { month: number } = {
        churchId: "church-xyz-123",
        year: 2025,
        month: 7,
      }

      const previousReq = (TrendController as any).getPreviousMonthRequest(req)

      expect(previousReq.churchId).toBe("church-xyz-123")
      expect(previousReq.year).toBe(2025)
      expect(previousReq.month).toBe(6)
    })
  })
})
