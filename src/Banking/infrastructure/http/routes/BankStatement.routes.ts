import { Request, Router } from "express"
import { Can, PermissionMiddleware } from "@/Shared/infrastructure"
import { ImportBankStatementValidator } from "../validators/ImportBankStatement.validator"
import {
  importBankStatementController,
  linkBankStatementController,
  listBankStatementsController,
  retryBankStatementController,
} from "../controllers/BankStatement.controller"
import { LinkBankStatementValidator } from "../validators/LinkBankStatement.validator"
import { HttpStatus } from "@/Shared/domain"
import { ListBankStatementsRequest } from "@/Banking/domain"

const bankStatementRoutes = Router()

bankStatementRoutes.get(
  "/",
  [PermissionMiddleware, Can("banking", ["statements", "read_statements"])],
  async (req: Request, res) => {
    const params = req.query as unknown as ListBankStatementsRequest
    await listBankStatementsController(
      {
        ...params,
        churchId: req.auth.churchId,
      },
      res
    )
  }
)

bankStatementRoutes.post(
  "/import",
  [
    PermissionMiddleware,
    Can("banking", "statements"),
    ImportBankStatementValidator,
  ],
  async (req: Request, res) => {
    const file = req.files?.file

    if (!file) {
      res.status(HttpStatus.BAD_REQUEST).send({
        file: {
          message: "Arquivo do extrato é obrigatório",
          rule: "required",
        },
      })
      return
    }

    await importBankStatementController(
      {
        ...req.body,
        file,
        uploadedBy: req.auth.name,
        churchId: req.auth.churchId,
      },
      res
    )
  }
)

bankStatementRoutes.post(
  "/:bankStatementId/retry",
  [PermissionMiddleware, Can("banking", "statements")],
  async (req: Request, res) => {
    await retryBankStatementController(
      {
        params: req.params as any,
        auth: req.auth,
      } as any,
      res
    )
  }
)

bankStatementRoutes.patch(
  "/:bankStatementId/link",
  [
    PermissionMiddleware,
    Can("banking", "statements"),
    LinkBankStatementValidator,
  ],
  async (req: Request, res) => {
    await linkBankStatementController(
      {
        params: req.params as any,
        body: req.body,
        auth: req.auth,
      } as any,
      res
    )
  }
)

export default bankStatementRoutes
