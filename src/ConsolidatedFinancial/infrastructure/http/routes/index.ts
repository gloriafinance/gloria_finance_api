import { Router } from "express"
import { UpdateFinancialMonthController } from "@/ConsolidatedFinancial/infrastructure/http/controllers"
import { PermissionMiddleware } from "@/Shared/infrastructure"

//Este route esta importado en Financial/infrastructure/http/routes/index.ts

const consolidatedFinancialRoutes = Router()

consolidatedFinancialRoutes.patch(
  "",
  PermissionMiddleware,
  async (req, res) => {
    await UpdateFinancialMonthController(
      { ...req.body, churchId: req["user"].churchId },
      res
    )
  }
)

export default consolidatedFinancialRoutes
