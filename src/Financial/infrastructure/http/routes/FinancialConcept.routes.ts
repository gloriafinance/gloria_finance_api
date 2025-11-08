import { Router } from "express"
import { PermissionMiddleware, Can } from "@/Shared/infrastructure"
import { FinancialConfigurationController } from "@/Financial/infrastructure/http/controllers/FinancialConfiguration.controller"
import { CreateOrUpdateFinancialConceptController } from "@/Financial/infrastructure/http/controllers/financialConcept/CreateOrUpdateFinancialConcept.controller"
import { ConceptType } from "@/Financial/domain"

const financialConceptRoutes = Router()

financialConceptRoutes.post(
  "/",
  PermissionMiddleware,
  Can("financial_configuration", "manage_concepts"),
  async (req, res) => {
  await CreateOrUpdateFinancialConceptController(
    {
      ...req.body,
      churchId: req["user"].churchId,
    },
    res
  )
  }
)

financialConceptRoutes.get(
  "/:churchId",
  PermissionMiddleware,
  Can("financial_configuration", "manage_concepts"),
  async (req, res) => {
    await FinancialConfigurationController.findFinancialConceptsByChurchIdAndTypeConcept(
      req.params.churchId,
      res
    )
  }
)

financialConceptRoutes.get(
  "/:churchId/:typeConcept",
  PermissionMiddleware,
  Can("financial_configuration", "manage_concepts"),
  async (req, res) => {
    await FinancialConfigurationController.findFinancialConceptsByChurchIdAndTypeConcept(
      req.params.churchId,
      res,
      req.params.typeConcept as ConceptType
    )
  }
)

export default financialConceptRoutes
