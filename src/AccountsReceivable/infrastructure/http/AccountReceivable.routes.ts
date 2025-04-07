import { Router } from "express"

import { PermissionMiddleware } from "@/Shared/infrastructure"
import {
  CreateAccountReceivableController,
  ListAccountReceivableController,
  PayAccountReceivableController,
} from "@/AccountsReceivable/infrastructure/http/controllers"
import { FilterAccountReceivableRequest } from "@/AccountsReceivable/domain"
import PayAccountReceivableValidator from "@/AccountsReceivable/infrastructure/http/validators/PayAccountReceivable.validator"
import { AmountValue } from "@/Shared/domain"

const accountReceivableRoutes = Router()

accountReceivableRoutes.post("/", PermissionMiddleware, async (req, res) => {
  await CreateAccountReceivableController(
    { ...req.body, churchId: req["user"].churchId },
    res
  )
})

accountReceivableRoutes.get("", PermissionMiddleware, async (req, res) => {
  await ListAccountReceivableController(
    {
      ...(req.query as unknown as FilterAccountReceivableRequest),
      churchId: req["user"].churchId,
    },
    res
  )
})

accountReceivableRoutes.post(
  "/pay",
  [PermissionMiddleware, PayAccountReceivableValidator],
  async (req, res) => {
    const installmentId = req.body.installmentId
    let installmentIds: string[] = []

    if (installmentId.includes(",")) {
      installmentIds = installmentId.split(",")
    } else {
      installmentIds = [installmentId]
    }

    await PayAccountReceivableController(
      {
        ...req.body,
        installmentIds,
        amount: AmountValue.create(req.body.amount),
        file: req?.files?.file,
      },
      res
    )
  }
)

export default accountReceivableRoutes
