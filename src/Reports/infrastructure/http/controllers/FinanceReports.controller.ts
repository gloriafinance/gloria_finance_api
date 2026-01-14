import * as fs from "fs"
import { Controller, Get, Query, Res, Use } from "@abejarano/ts-express-server"
import type { ServerResponse } from "@abejarano/ts-express-server"
import { DREResponse, TrendResponse } from "@/Reports/domain"
import type { BaseReportRequest } from "@/Reports/domain"
import { DRE, IncomeStatement, MonthlyTithes } from "@/Reports/applications"
import { DREMongoRepository } from "@/Reports/infrastructure/persistence/DREMongoRepository"
import domainResponse from "@/Shared/helpers/domainResponse"
import { Can, NoOpStorage, PermissionMiddleware } from "@/Shared/infrastructure"
import { HttpStatus } from "@/Shared/domain"
import { FinanceRecordMongoRepository } from "@/Financial/infrastructure"
import { ChurchMongoRepository } from "@/Church/infrastructure"
import { CostCenterMasterMongoRepository } from "@/Financial/infrastructure/persistence"
import { AvailabilityAccountMasterMongoRepository } from "@/Financial/infrastructure/persistence/AvailabilityAccountMasterMongoRepository"
import { HandlebarsHTMLAdapter, PuppeteerAdapter } from "@/Shared/adapter"
import { Cache } from "@/Shared/decorators"

@Controller("/api/v1/reports/finance")
export class FinanceReportsController {
  /**
   * TithesController
   *
   * @description Fetch a list of tithes for the given church and date range.
   *
   * @param {BaseReportRequest} req - The request object.
   * @param {Response} res - The response object.
   *
   * @returns {Promise<void>} - A promise that resolves when the request has been
   * processed.
   *
   * @throws {Error} - If the request is invalid or an error occurs.
   *
   * @example
   * // Request
   * GET /monthly-tithes?churchId=123&year=2022&month=1
   *
   * // Response
   * [
   *   {
   *     "amount": 100,
   *     "date": "2022-01-01T00:00:00.000Z",
   *     "availabilityAccountName": "Iglesia de Dios",
   *     "availabilityAccountType": "BANK"
   *   }
   * ]
   */
  @Get("/monthly-tithes")
  @Use([PermissionMiddleware, Can("reports", "monthly_tithes")])
  async monthlyTithes(
    @Query() query: BaseReportRequest,
    @Res() res: ServerResponse
  ): Promise<void> {
    try {
      const list = await new MonthlyTithes(
        FinanceRecordMongoRepository.getInstance(),
        ChurchMongoRepository.getInstance()
      ).execute(query)

      res.status(HttpStatus.OK).send(list)
    } catch (e) {
      domainResponse(e, res)
    }
  }

  /**
   * IncomeStatementController
   *
   * @description Generates a financial income statement for the specified church
   * summarizing revenues, margins, and a cash snapshot used for validation.
   *
   * @param {BaseReportRequest} req - The request object with filtering parameters.
   * @param {Response} res - The response object.
   *
   * @returns {Promise<void>} - A promise that resolves when the request has been</void>
   * processed.
   *
   * @throws {Error} - If the request is invalid or an error occurs.
   *
   * @example
   * // Request
   * GET /income-statement?churchId=123&year=2022&month=1
   *
   * // Response
   * {
   *   "period": { "year": 2024, "month": 5 },
   *   "summary": {
   *     "revenue": 12000,
   *     "cogs": 3000,
   *     "grossProfit": 9000,
   *     "operatingExpenses": 4500,
   *     "operatingIncome": 4500,
   *     "otherIncome": 500,
   *     "otherExpenses": 200,
   *     "otherNet": 300,
   *     "netIncome": 4800
   *   },
   *   "breakdown": [
   *     { "category": "REVENUE", "income": 12500, "expenses": 500, "net": 12000 },
   *     { "category": "COGS", "income": 0, "expenses": 3000, "net": -3000 },
   *     { "category": "OPEX", "income": 0, "expenses": 4500, "net": -4500 },
   *     { "category": "OTHER", "income": 500, "expenses": 200, "net": 300 }
   *   ],
   *   "cashFlowSnapshot": {
   *     "availabilityAccounts": {
   *       "accounts": [...],
   *       "total": 18000,
   *       "income": 15000,
   *       "expenses": 2000
   *     },
   *     "costCenters": {
   *       "costCenters": [...],
   *       "total": 5000
   *     }
   *   }
   * }
   *
   */
  @Get("/income-statement")
  @Use([PermissionMiddleware, Can("reports", "income_statements")])
  async incomeStatement(
    @Query() query: BaseReportRequest,
    @Res() res: ServerResponse
  ): Promise<void> {
    try {
      const result = await new IncomeStatement(
        FinanceRecordMongoRepository.getInstance(),
        CostCenterMasterMongoRepository.getInstance(),
        AvailabilityAccountMasterMongoRepository.getInstance(),
        ChurchMongoRepository.getInstance()
      ).execute(query)

      res.status(HttpStatus.OK).json(result)
    } catch (e) {
      domainResponse(e, res)
    }
  }

  @Get("/income-statement/pdf")
  @Use([PermissionMiddleware, Can("reports", "income_statements")])
  async incomeStatementPdf(
    @Query() query: BaseReportRequest,
    @Res() res: ServerResponse
  ): Promise<void> {
    try {
      const incomeStatement = await new IncomeStatement(
        FinanceRecordMongoRepository.getInstance(),
        CostCenterMasterMongoRepository.getInstance(),
        AvailabilityAccountMasterMongoRepository.getInstance(),
        ChurchMongoRepository.getInstance()
      ).execute(query)

      const pdfPath = await new PuppeteerAdapter(
        new HandlebarsHTMLAdapter(),
        NoOpStorage.getInstance()
      )
        .htmlTemplate("financial_report", incomeStatement)
        .toPDF(false)

      const year = incomeStatement.period.year ?? query.year
      const month = incomeStatement.period.month ?? query.month
      const fileName = `financial-report-${year}${month ? `-${month}` : ""}.pdf`

      res.download(pdfPath, fileName, (error) => {
        fs.unlink(pdfPath, () => undefined)

        //if (error && !res.headersSent) {
        if (error) {
          console.log(error)
          domainResponse(error, res)
        }
      })
    } catch (error) {
      console.log(error)
      domainResponse(error, res)
    }
  }

  /**
   * DREController
   *
   * @description Generates a DRE (Demonstração do Resultado do Exercício - Income Statement)
   * report for the specified church, month, and year. The report includes:
   * - Receita Bruta (Gross Revenue)
   * - Receita Líquida (Net Revenue)
   * - Custos Diretos (Direct Costs/COGS)
   * - Resultado Bruto (Gross Profit)
   * - Despesas Operacionais (Operating Expenses)
   * - Resultado Operacional (Operating Result)
   * - Resultados Extraordinários (Extraordinary Results)
   * - Resultado Líquido (Net Result)
   *
   * The report only includes financial records with:
   * - status = CLEARED or RECONCILED
   * - affectsResult = true in the financial concept
   * - date within the specified month/year
   *
   * @param {BaseReportRequest} req - The request object with filtering parameters (churchId, year, month).
   * @param {Response} res - The response object.
   *
   * @returns {Promise<void>} - A promise that resolves when the request has been processed.
   *
   * @throws {Error} - If the request is invalid or an error occurs.
   *
   * @example
   * // Request
   * GET /reports/finance/dre?churchId=123&year=2024&month=5
   *
   * // Response
   * {
   *   "grossRevenue": 3117.05,
   *   "netRevenue": 3117.05,
   *   "directCosts": 0,
   *   "grossProfit": 3117.05,
   *   "operationalExpenses": 101.5,
   *   "operationalResult": 3015.55,
   *   "extraordinaryResults": 0,
   *   "netResult": 3015.55
   * }
   */
  @Get("/dre")
  @Use([PermissionMiddleware, Can("financial_records", "reports")])
  async dre(
    @Query() query: BaseReportRequest & { month: number },
    @Res() res: ServerResponse
  ): Promise<void> {
    try {
      const result = await new DRE(
        FinanceRecordMongoRepository.getInstance(),
        DREMongoRepository.getInstance(),
        ChurchMongoRepository.getInstance()
      ).execute(query)

      res.status(HttpStatus.OK).json(result)
    } catch (e) {
      domainResponse(e, res)
    }
  }

  /**
   * DREPdfController
   *
   * @description Generates a PDF version of the DRE (Demonstração do Resultado do Exercício)
   * report for the specified church, month, and year. Returns a downloadable PDF file.
   *
   * @param {BaseReportRequest} req - The request object with filtering parameters (churchId, year, month).
   * @param {Response} res - The response object.
   *
   * @returns {Promise<void>} - A promise that resolves when the PDF has been sent.
   *
   * @throws {Error} - If the request is invalid or an error occurs.
   *
   * @example
   * // Request
   * GET /reports/finance/dre/pdf?churchId=123&year=2024&month=5
   *
   * // Response
   * Content-Type: application/pdf
   * Content-Disposition: attachment; filename="dre-2024-5.pdf"
   * [PDF binary data]
   */
  @Get("/dre/pdf")
  @Use([PermissionMiddleware, Can("financial_records", "reports")])
  async drePdf(
    @Query() query: BaseReportRequest & { month: number },
    @Res() res: ServerResponse
  ): Promise<void> {
    try {
      const dreReport = await new DRE(
        FinanceRecordMongoRepository.getInstance(),
        DREMongoRepository.getInstance(),
        ChurchMongoRepository.getInstance()
      ).execute(query)

      const pdfPath = await new PuppeteerAdapter(
        new HandlebarsHTMLAdapter(),
        NoOpStorage.getInstance()
      )
        .htmlTemplate("dre_report", dreReport)
        .toPDF(false)

      const year = query.year
      const month = query.month
      const fileName = `dre-${year}${month ? `-${month}` : ""}.pdf`

      res.download(pdfPath, fileName, (error) => {
        fs.unlink(pdfPath, () => undefined)

        //if (error && !res.headersSent) {
        if (error) {
          domainResponse(error, res)
        }
      })
    } catch (error) {
      domainResponse(error, res)
    }
  }

  @Cache("trend", 600)
  @Get("/dre/trend")
  @Use([PermissionMiddleware, Can("financial_records", "reports")])
  async dreTrend(
    @Query() query: BaseReportRequest & { month: number },
    @Res() res: ServerResponse
  ): Promise<void> {
    try {
      const normalizedReq = this.normalizeRequest(query)
      const previousMonthReq = this.getPreviousMonthRequest(normalizedReq)

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

  private normalizeRequest(
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
  private getPreviousMonthRequest(
    req: BaseReportRequest & { month: number; year: number }
  ): BaseReportRequest & { month: number; year: number } {
    const currentMonth = Number(req.month)
    const currentYear = Number(req.year)

    const previousMonth = currentMonth === 1 ? 12 : currentMonth - 1
    const previousYear = currentMonth === 1 ? currentYear - 1 : currentYear

    return {
      ...req,
      month: previousMonth,
      year: previousYear,
    }
  }
}
