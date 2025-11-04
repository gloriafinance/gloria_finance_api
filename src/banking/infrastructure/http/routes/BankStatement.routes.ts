import { Request, Router } from "express"
import { PermissionMiddleware } from "@/Shared/infrastructure"
import { ImportBankStatementValidator } from "../validators/ImportBankStatement.validator"
import { importBankStatementController } from "../controllers/BankStatement.controller"

const bankStatementRoutes = Router()

bankStatementRoutes.post(
  "/import",
  [PermissionMiddleware, ImportBankStatementValidator],
  async (req: Request, res) => {
    await importBankStatementController(
      {
        ...(req.body as Record<string, unknown>),
        files: req.files as Record<string, unknown>,
        user: req["user"],
      } as any,
      res
    )
  }
)

export default bankStatementRoutes

