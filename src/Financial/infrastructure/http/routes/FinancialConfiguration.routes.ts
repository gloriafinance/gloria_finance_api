import { Router } from "express"
import { AvailabilityAccountRequest, CostCenterRequest } from "../../../domain"
import { PermissionMiddleware, Can } from "@/Shared/infrastructure"
import AvailabilityAccountValidator from "../validators/AvailabilityAccount.validator"
import {
  createOrUpdateAvailabilityAccount,
  listAvailabilityAccountByChurchId,
} from "../controllers/AvailabilityAccount.controller"
import {
  CreateCostCenterController,
  FindCostCenterByChurchIdController,
  UpdateCostCenterController,
} from "../controllers/CostCenter.controller"

const financialConfigurationRoute = Router()

financialConfigurationRoute.post(
  "/cost-center",
  [PermissionMiddleware, Can("financial_configuration", "cost_centers")],
  async (req, res) => {
    await CreateCostCenterController(req.body as CostCenterRequest, res)
  }
)

financialConfigurationRoute.put(
  "/cost-center",
  [PermissionMiddleware, Can("financial_configuration", "cost_centers")],
  async (req, res) => {
    await UpdateCostCenterController(req.body as CostCenterRequest, res)
  }
)

financialConfigurationRoute.get(
  "/cost-center/:churchId",
  PermissionMiddleware,
  Can("financial_configuration", "cost_centers"),
  async (req, res) => {
    await FindCostCenterByChurchIdController(req.params.churchId, res)
  }
)

financialConfigurationRoute.post(
  "/availability-account",
  [
    PermissionMiddleware,
    Can("financial_configuration", "availability_accounts"),
    AvailabilityAccountValidator,
  ],
  async (req, res) => {
    await createOrUpdateAvailabilityAccount(
      {
        ...(req.body as AvailabilityAccountRequest),
        churchId: req["user"].churchId,
      },
      res
    )
  }
)

financialConfigurationRoute.get(
  "/availability-account/:churchId",
  PermissionMiddleware,
  Can("financial_configuration", "availability_accounts"),
  async (req, res) => {
    await listAvailabilityAccountByChurchId(req.params.churchId, res)
  }
)

export default financialConfigurationRoute
