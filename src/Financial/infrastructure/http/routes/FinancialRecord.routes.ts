import { Router } from "express"
import { PermissionMiddleware } from "@/Shared/infrastructure"
import {
  FilterFinanceRecordRequest,
  FinanceRecordReportRequest,
} from "../../../domain"
import FinancialRecordValidator from "../validators/FinancialRecord.validator"
import {
  CancelFinancialRecordController,
  FinancialRecordController,
} from "../controllers/FinancialRecord.controller"
import { FinanceRecordListController } from "../controllers/FinanceRecordList.controller"
import { GenerateFinanceRecordReportController } from "../controllers/GenerateFinanceRecordReport.controller"

const financialRecordRoutes = Router()

financialRecordRoutes.post(
  "/",
  [PermissionMiddleware, FinancialRecordValidator],
  async (req, res) => {
    await FinancialRecordController(
      {
        ...req.body,
        churchId: req["user"].churchId,
        file: req?.files?.file,
      },
      res
    )
  }
)

financialRecordRoutes.patch(
  "/cancel/:financialRecordId",
  [PermissionMiddleware],
  async (req, res) => {
    await CancelFinancialRecordController(
      {
        financialRecordId: req.params.financialRecordId,
        churchId: req["user"].churchId,
      },
      res
    )
  }
)

financialRecordRoutes.get("/", PermissionMiddleware, async (req, res) => {
  const params = req.query as unknown as FilterFinanceRecordRequest
  await FinanceRecordListController(
    { ...params, churchId: req["user"].churchId },
    res
  )
})

financialRecordRoutes.get("/export", PermissionMiddleware, async (req, res) => {
  const params = req.query as unknown as FinanceRecordReportRequest
  await GenerateFinanceRecordReportController(
    { ...params, churchId: req["user"].churchId },
    res
  )
})

export default financialRecordRoutes
