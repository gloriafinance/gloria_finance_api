import { Router } from "express"

import { PermissionMiddleware, Can } from "@/Shared/infrastructure"
import {
  ConfirmOrDenyPaymentCommitmentController,
  CreateAccountReceivableController,
  ListAccountReceivableController,
  PayAccountReceivableController,
} from "@/AccountsReceivable/infrastructure/http/controllers"
import { FilterAccountReceivableRequest } from "@/AccountsReceivable/domain"
import PayAccountReceivableValidator from "@/AccountsReceivable/infrastructure/http/validators/PayAccountReceivable.validator"
import { AmountValue } from "@/Shared/domain"
import CreateAccountReceivableValidator from "@/AccountsReceivable/infrastructure/http/validators/CreateAccountReceivable.validator"

const accountsReceivableRoutes = Router()

accountsReceivableRoutes.post(
  "/",
  [
    PermissionMiddleware,
    Can("accounts_receivable", "manage"),
    CreateAccountReceivableValidator,
  ],
  async (req, res) => {
    await CreateAccountReceivableController(
      {
        ...req.body,
        churchId: req.auth.churchId,
        createdBy: req.auth.name,
      },
      res
    )
  }
)

accountsReceivableRoutes.get(
  "",
  PermissionMiddleware,
  Can("accounts_receivable", "read"),
  async (req, res) => {
    await ListAccountReceivableController(
      {
        ...(req.query as unknown as FilterAccountReceivableRequest),
        churchId: req.auth.churchId,
      },
      res
    )
  }
)

accountsReceivableRoutes.post(
  "/pay",
  [
    PermissionMiddleware,
    Can("accounts_receivable", "apply_payments"),
    PayAccountReceivableValidator,
  ],
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
        churchId: req.auth.churchId,
        createdBy: req.auth.name,
        installmentIds,
        amount: AmountValue.create(req.body.amount),
        file: req?.files?.file,
      },
      res
    )
  }
)

accountsReceivableRoutes.patch(
  "/confirm-payment-commitment",
  PermissionMiddleware,
  Can("accounts_receivable", "commitments"),
  async (req, res) => {
    await ConfirmOrDenyPaymentCommitmentController(req.body, res)
  }
)

export default accountsReceivableRoutes
