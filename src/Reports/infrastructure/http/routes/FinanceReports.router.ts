import { Router } from "express"
import { TithesController } from "../controllers/Tithes.controller"
import { PermissionMiddleware, Can } from "@/Shared/infrastructure"
import { BaseReportRequest } from "../../../domain"
import { IncomeStatementController } from "../controllers/IncomeStatement.controller"
import { IncomeStatementPdfController } from "../controllers/IncomeStatementPdf.controller"

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

export default reportFinanceRouter
