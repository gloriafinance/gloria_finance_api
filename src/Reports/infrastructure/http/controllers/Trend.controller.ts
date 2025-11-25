import { BaseReportRequest, DREResponse, TrendResponse } from "@/Reports/domain"
import { Response } from "express"
import { Cache } from "@/Shared/decorators"
import { DRE } from "@/Reports/applications"
import { FinanceRecordMongoRepository } from "@/Financial/infrastructure"
import { DREMongoRepository } from "@/Reports/infrastructure/persistence/DREMongoRepository"
import { ChurchMongoRepository } from "@/Church/infrastructure"
import { HttpStatus } from "@/Shared/domain"
import domainResponse from "@/Shared/helpers/domainResponse"

export class TrendController {
  @Cache("trend", 600)
  static async handle(
    req: BaseReportRequest & { month: number },
    res: Response
  ): Promise<void> {
    try {
      const normalizedReq = TrendController.normalizeRequest(req)
      // Generate request for previous month
      const previousMonthReq =
        TrendController.getPreviousMonthRequest(normalizedReq)

      const dreReport: DREResponse = await new DRE(
        FinanceRecordMongoRepository.getInstance(),
        DREMongoRepository.getInstance(),
        ChurchMongoRepository.getInstance()
      ).execute(normalizedReq)

      const previousDreReport: DREResponse = await new DRE(
        FinanceRecordMongoRepository.getInstance(),
        DREMongoRepository.getInstance(),
        ChurchMongoRepository.getInstance()
      ).execute(previousMonthReq)

      // Build trend response
      const trendResponse: TrendResponse = {
        period: {
          year: normalizedReq.year,
          month: normalizedReq.month,
        },
        trend: {
          revenue: {
            current: dreReport.grossRevenue,
            previous: previousDreReport.grossRevenue,
          },
          opex: {
            current: dreReport.operationalExpenses,
            previous: previousDreReport.operationalExpenses,
          },
          transfers: {
            current: dreReport.ministryTransfers,
            previous: previousDreReport.ministryTransfers,
          },
          capex: {
            current: dreReport.capexInvestments,
            previous: previousDreReport.capexInvestments,
          },
          netIncome: {
            current: dreReport.netResult,
            previous: previousDreReport.netResult,
          },
        },
      }

      res.status(HttpStatus.OK).json(trendResponse)
    } catch (error) {
      domainResponse(error, res)
    }
  }

  private static normalizeRequest(
    req: BaseReportRequest & { month: number }
  ): BaseReportRequest & { month: number; year: number } {
    const month = Number(req.month)
    const year = Number(req.year)

    const safeMonth =
      Number.isFinite(month) && month >= 1 && month <= 12 ? month : 1
    const safeYear = Number.isFinite(year) ? year : new Date().getUTCFullYear()

    return {
      ...req,
      month: safeMonth,
      year: safeYear,
    }
  }

  /**
   * Generates a request for the previous month
   * Handles year rollback when month is January
   * @param req - Current request with month and year
   * @returns Request for the previous month
   */
  private static getPreviousMonthRequest(
    req: BaseReportRequest & { month: number; year: number }
  ): BaseReportRequest & { month: number; year: number } {
    const currentMonth = Number(req.month)
    const currentYear = Number(req.year)

    // If current month is January (1), go back to December (12) of previous year
    const previousMonth = currentMonth === 1 ? 12 : currentMonth - 1
    const previousYear = currentMonth === 1 ? currentYear - 1 : currentYear

    return {
      ...req,
      month: previousMonth,
      year: previousYear,
    }
  }
}
