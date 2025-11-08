import { Request, Response, Router } from "express"
import { PermissionMiddleware, Can } from "@/Shared/infrastructure"
import {
  CreateAccountPayableController,
  ListAccountPayableController,
  PayAccountPayableController,
} from "@/AccountsPayable/infrastructure/http/controllers"
import CreateAccountPayableValidator from "@/AccountsPayable/infrastructure/http/validators/CreateAccountPayable.validator"
import { AmountValue } from "@/Shared/domain"
import { FilterAccountPayableRequest } from "@/AccountsPayable/domain"
import PayAccountPayableValidator from "@/AccountsPayable/infrastructure/http/validators/PayAccountPayable.validator"

const accountsPayableRoute = Router()

accountsPayableRoute.post(
  "/",
  [
    PermissionMiddleware,
    Can("accounts_payable", "manage"),
    CreateAccountPayableValidator,
  ],
  async (req: Request, res: Response) => {
    await CreateAccountPayableController(
      {
        ...req.body,
        churchId: req["user"].churchId,
        createdBy: req["user"].name,
      },
      res
    )
  }
)

accountsPayableRoute.post(
  "/pay",
  [
    PermissionMiddleware,
    Can("accounts_payable", "reconcile"),
    PayAccountPayableValidator,
  ],
  async (req: Request, res: Response) => {
    const installmentId = req.body.installmentId
    let installmentIds: string[] = []

    if (installmentId.includes(",")) {
      installmentIds = installmentId.split(",")
    } else {
      installmentIds = [installmentId]
    }

    await PayAccountPayableController(
      {
        ...req.body,
        createdBy: req["user"].name,
        installmentIds,
        amount: AmountValue.create(req.body.amount),
        file: req?.files?.file,
      },
      res
    )
  }
)

accountsPayableRoute.get(
  "",
  PermissionMiddleware,
  Can("accounts_payable", "read"),
  async (req: Request, res: Response) => {
    await ListAccountPayableController(
      {
        ...(req.query as unknown as FilterAccountPayableRequest),
        churchId: req["user"].churchId,
      },
      res
    )
  }
)

export default accountsPayableRoute
