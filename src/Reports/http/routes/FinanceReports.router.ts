import { Router } from "express"
import { TithesController } from "../controllers/Tithes.controller"
import { PermissionMiddleware } from "../../../Shared/infrastructure"
import { BaseReportRequest } from "../../domain"
import { IncomeStatementController } from "../controllers/IncomeStatement.controller"

const reportFinanceRouter = Router()

reportFinanceRouter.get(
  "/monthly-tithes",
  PermissionMiddleware,
  async (req, res) => {
    await TithesController(req.query as unknown as BaseReportRequest, res)
  }
)

reportFinanceRouter.get(
  "/income-statement",
  PermissionMiddleware,
  async (req, res) => {
    await IncomeStatementController(
      req.query as unknown as BaseReportRequest,
      res
    )
  }
)

export default reportFinanceRouter
