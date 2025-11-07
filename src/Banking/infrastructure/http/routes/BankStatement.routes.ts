import { Request, Router } from "express"
import { PermissionMiddleware } from "@/Shared/infrastructure"
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
  [PermissionMiddleware],
  async (req: Request, res) => {
    const params = req.query as unknown as ListBankStatementsRequest
    await listBankStatementsController(
      {
        ...params,
        churchId: req["user"].churchId,
      },
      res
    )
  }
)

bankStatementRoutes.post(
  "/import",
  [PermissionMiddleware, ImportBankStatementValidator],
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
        uploadedBy: req["user"].name,
        churchId: req["user"].churchId,
      },
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
