import { Request, Router } from "express"
import { PermissionMiddleware } from "@/Shared/infrastructure"
import { ImportBankStatementValidator } from "../validators/ImportBankStatement.validator"
import {
  importBankStatementController,
  linkBankStatementController,
  listBankStatementsController,
  retryBankStatementController,
} from "../controllers/BankStatement.controller"
import { ListBankStatementsValidator } from "../validators/ListBankStatements.validator"
import { LinkBankStatementValidator } from "../validators/LinkBankStatement.validator"

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

bankStatementRoutes.get(
  "/",
  [PermissionMiddleware, ListBankStatementsValidator],
  async (req: Request, res) => {
    await listBankStatementsController(
      {
        query: req.query,
        user: req["user"],
      } as any,
      res
    )
  }
)

bankStatementRoutes.post(
  "/:bankStatementId/retry",
  [PermissionMiddleware],
  async (req: Request, res) => {
    await retryBankStatementController(
      {
        params: req.params as any,
        user: req["user"],
      } as any,
      res
    )
  }
)

bankStatementRoutes.patch(
  "/:bankStatementId/link",
  [PermissionMiddleware, LinkBankStatementValidator],
  async (req: Request, res) => {
    await linkBankStatementController(
      {
        params: req.params as any,
        body: req.body,
        user: req["user"],
      } as any,
      res
    )
  }
)

export default bankStatementRoutes
