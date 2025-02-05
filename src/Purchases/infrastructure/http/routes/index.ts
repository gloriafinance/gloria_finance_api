import { Request, Response, Router } from "express"
import { PermissionMiddleware } from "../../../../Shared/infrastructure"
import { recordPurchaseController } from "../controllers/Purchase.controller"
import PurchaseValidator from "../validators/Purchase.validator"

const purchaseRouter = Router()

purchaseRouter.post(
  "/",
  [PermissionMiddleware, PurchaseValidator],
  async (req: Request, res: Response) => {
    await recordPurchaseController(
      {
        ...req.body,
        churchId: req["user"].churchId,
        file: req.files.invoice,
      },
      res
    )
  }
)

export default purchaseRouter
