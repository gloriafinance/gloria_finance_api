import { Router } from "express"
import { FinancialConfigurationController } from "../controllers/FinancialConfiguration.controller"
import bankValidator from "../validators/Bank.validator"
import bankBRValidator from "../validators/BankBR.validator"
import {
  AvailabilityAccountRequest,
  BankRequest,
  ConceptType,
  CostCenterRequest,
} from "../../../domain"
import { PermissionMiddleware } from "../../../../Shared/infrastructure"
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
  PermissionMiddleware,
  async (req, res) => {
    await CreateCostCenterController(req.body as CostCenterRequest, res)
  }
)

financialConfigurationRoute.put(
  "/cost-center",
  PermissionMiddleware,
  async (req, res) => {
    await UpdateCostCenterController(req.body as CostCenterRequest, res)
  }
)

financialConfigurationRoute.get("/cost-center/:churchId", async (req, res) => {
  await FindCostCenterByChurchIdController(req.params.churchId, res)
})

//TODO sera necesario crear endpoint por pais para el registro de banco?
financialConfigurationRoute.post(
  "/bank",
  [PermissionMiddleware, bankValidator, bankBRValidator],
  async (req, res) => {
    await FinancialConfigurationController.createOrUpdateBank(
      req.body as BankRequest,
      res
    )
  }
)

financialConfigurationRoute.get(
  "/bank/:churchId",
  PermissionMiddleware,
  async (req, res) => {
    await FinancialConfigurationController.listBankByChurchId(
      req.params.churchId,
      res
    )
  }
)

financialConfigurationRoute.get("/bank/data/:bankId", async (req, res) => {
  await FinancialConfigurationController.findBankByBankId(
    req.params.bankId,
    res
  )
})

financialConfigurationRoute.get(
  "/financial-concepts/:churchId/:typeConcept",
  PermissionMiddleware,
  async (req, res) => {
    await FinancialConfigurationController.findFinancialConceptsByChurchIdAndTypeConcept(
      req.params.churchId,
      res,
      req.params.typeConcept as ConceptType
    )
  }
)

financialConfigurationRoute.get(
  "/financial-concepts/:churchId",
  PermissionMiddleware,
  async (req, res) => {
    await FinancialConfigurationController.findFinancialConceptsByChurchIdAndTypeConcept(
      req.params.churchId,
      res
    )
  }
)

financialConfigurationRoute.post(
  "/availability-account",
  [PermissionMiddleware, AvailabilityAccountValidator],
  async (req, res) => {
    await createOrUpdateAvailabilityAccount(
      req.body as AvailabilityAccountRequest,
      res
    )
  }
)

financialConfigurationRoute.get(
  "/availability-account/:churchId",
  PermissionMiddleware,
  async (req, res) => {
    await listAvailabilityAccountByChurchId(req.params.churchId, res)
  }
)

export default financialConfigurationRoute
