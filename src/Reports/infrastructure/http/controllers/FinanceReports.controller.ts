import * as fs from "fs"
import {
  Controller,
  Get,
  Query,
  Req,
  Res,
  type ServerResponse,
  Use,
} from "bun-platform-kit"
import type {
  BaseReportRequest,
  DREResponse,
  TrendResponse,
} from "@/Reports/domain"
import { DRE, IncomeStatement, MonthlyTithes } from "@/Reports/applications"
import { DREMongoRepository } from "@/Reports/infrastructure/persistence/DREMongoRepository"
import domainResponse from "@/Shared/helpers/domainResponse"
import {
  type AuthenticatedRequest,
  Can,
  NoOpStorage,
  PermissionMiddleware,
  QueueService,
} from "@/Shared/infrastructure"
import { HttpStatus } from "@/Shared/domain"
import { FinanceRecordMongoRepository } from "@/Financial/infrastructure"
import { ChurchMongoRepository } from "@/Church/infrastructure"
import { CostCenterMasterMongoRepository } from "@/Financial/infrastructure/persistence"
import { AvailabilityAccountMasterMongoRepository } from "@/Financial/infrastructure/persistence/AvailabilityAccountMasterMongoRepository"
import { HandlebarsHTMLAdapter, PuppeteerAdapter } from "@/Shared/adapter"
import { Cache } from "@/Shared/decorators"
import { QueueName } from "@/package/queue/domain"
import type { IncomeStatementJobRequest } from "../jobs/incomeStatement.job"
import type { DREJobRequest } from "../jobs/DRE.job"

@Controller("/api/v1/reports/finance")
export class FinanceReportsController {
  /**
   * TithesController
   *
   * @description Fetch a list of tithes for the given church and date range.
   *
   * @param query
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
   * @param query
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
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ): Promise<void> {
    try {
      const incomeStatement = await new IncomeStatement(
        FinanceRecordMongoRepository.getInstance(),
        CostCenterMasterMongoRepository.getInstance(),
        AvailabilityAccountMasterMongoRepository.getInstance(),
        ChurchMongoRepository.getInstance()
      ).execute(query)

      QueueService.getInstance().dispatch<IncomeStatementJobRequest>(
        QueueName.IncomeStatementJob,
        {
          incomeStatement: incomeStatement,
          lang: req.auth.lang,
          email: req.auth.email,
          client: req.auth.name,
        }
      )

      res.status(HttpStatus.OK).send({
        message: "income statement is arriving in your email",
      })
    } catch (error) {
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
   * @param query
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
   * [{
   *   "symbol": "USDT",
   *   "grossRevenue": 36,
   *   "netRevenue": 36,
   *   "directCosts": 0,
   *   "grossProfit": 36,
   *   "operationalExpenses": 10,
   *   "ministryTransfers": 0,
   *   "capexInvestments": 0,
   *   "extraordinaryResults": 0,
   *   "operationalResult": 26,
   *   "netResult": 26
   * }]
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

      res.status(HttpStatus.OK).json(result.totalsBySymbol)
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
   * @param query
   * @param req
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
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ): Promise<void> {
    try {
      const dreReport = await new DRE(
        FinanceRecordMongoRepository.getInstance(),
        DREMongoRepository.getInstance(),
        ChurchMongoRepository.getInstance()
      ).execute(query)

      QueueService.getInstance().dispatch<DREJobRequest>(
        QueueName.IncomeStatementJob,
        {
          dreReport,
          lang: req.auth.lang,
          email: req.auth.email,
          client: req.auth.name,
        }
      )

      res.status(HttpStatus.OK).send({
        message: "income statement is arriving in your email",
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
