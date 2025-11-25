import { Router } from "express"
import { TithesController } from "../controllers/Tithes.controller"
import { Can, PermissionMiddleware } from "@/Shared/infrastructure"
import { BaseReportRequest } from "../../../domain"
import { IncomeStatementController } from "../controllers/IncomeStatement.controller"
import { IncomeStatementPdfController } from "../controllers/IncomeStatementPdf.controller"
import { DREController } from "../controllers/DRE.controller"
import { DREPdfController } from "../controllers/DREPdf.controller"
import { TrendController } from "../controllers/Trend.controller"

const reportFinanceRouter = Router()

reportFinanceRouter.get(
  "/monthly-tithes",
  PermissionMiddleware,
  Can("reports", "monthly_tithes"),
  async (req, res) => {
    await TithesController(req.query as unknown as BaseReportRequest, res)
  }
)

reportFinanceRouter.get(
  "/income-statement",
  PermissionMiddleware,
  Can("reports", "income_statements"),
  async (req, res) => {
    await IncomeStatementController(
      req.query as unknown as BaseReportRequest,
      res
    )
  }
)

reportFinanceRouter.get(
  "/income-statement/pdf",
  PermissionMiddleware,
  Can("reports", "income_statements"),
  async (req, res) => {
    await IncomeStatementPdfController(
      req.query as unknown as BaseReportRequest,
      res
    )
  }
)

reportFinanceRouter.get(
  "/dre",
  PermissionMiddleware,
  Can("financial_records", "reports"),
  async (req, res) => {
    await DREController(
      req.query as unknown as BaseReportRequest & {
        month: number
      },
      res
    )
  }
)

reportFinanceRouter.get(
  "/dre/pdf",
  PermissionMiddleware,
  Can("financial_records", "reports"),
  async (req, res) => {
    await DREPdfController(
      req.query as unknown as BaseReportRequest & {
        month: number
      },
      res
    )
  }
)

reportFinanceRouter.get(
  "/dre/trend",
  PermissionMiddleware,
  Can("financial_records", "reports"),
  async (req, res) => {
    await TrendController.handle(
      req.query as unknown as BaseReportRequest & {
        month: number
      },
      res
    )
  }
)

export default reportFinanceRouter
