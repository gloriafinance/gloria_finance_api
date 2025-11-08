import { Router } from "express"
import { PermissionMiddleware, Can } from "@/Shared/infrastructure"
import {
  FilterFinanceRecordRequest,
  FinanceRecordReportRequest,
} from "../../../domain"
import FinancialRecordValidator from "../validators/FinancialRecord.validator"
import {
  CancelFinancialRecordController,
  FinancialRecordController,
} from "../controllers/FinancialRecord.controller"
import { GenerateFinanceRecordReportController } from "../controllers/GenerateFinanceRecordReport.controller"
import { FetchingFinanceRecordController } from "@/Financial/infrastructure/http/controllers/FetchingFinanceRecordController"

const financialRecordRoutes = Router()

financialRecordRoutes.post(
  "/",
  [
    PermissionMiddleware,
    Can("financial_records", "create"),
    FinancialRecordValidator,
  ],
  async (req, res) => {
    await FinancialRecordController(
      {
        ...req.body,
        churchId: req["user"].churchId,
        createdBy: req["user"].name,
        file: req?.files?.file,
      },
      res
    )
  }
)

financialRecordRoutes.patch(
  "/cancel/:financialRecordId",
  [PermissionMiddleware, Can("financial_records", "cancel")],
  async (req, res) => {
    await CancelFinancialRecordController(
      {
        financialRecordId: req.params.financialRecordId,
        churchId: req["user"].churchId,
        createdBy: req["user"].name,
      },
      res
    )
  }
)

financialRecordRoutes.get(
  "/",
  PermissionMiddleware,
  Can("financial_records", "read"),
  async (req, res) => {
    const params = req.query as unknown as FilterFinanceRecordRequest
    await FetchingFinanceRecordController(
      { ...params, churchId: req["user"].churchId },
      res
    )
  }
)

financialRecordRoutes.get(
  "/export",
  PermissionMiddleware,
  Can("financial_records", "reports"),
  async (req, res) => {
    const params = req.query as unknown as FinanceRecordReportRequest
    await GenerateFinanceRecordReportController(
      { ...params, churchId: req["user"].churchId },
      res
    )
  }
)

export default financialRecordRoutes
