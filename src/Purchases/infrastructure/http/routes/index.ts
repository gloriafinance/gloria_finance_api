import { Request, Response, Router } from "express"
import { PermissionMiddleware, Can } from "@/Shared/infrastructure"
import {
  listPurchasesController,
  RecordPurchaseController,
} from "../controllers/Purchase.controller"
import PurchaseValidator from "../validators/Purchase.validator"
import { FilterPurchasesRequest } from "../../../domain/requests"

const purchaseRouter = Router()

purchaseRouter.post(
  "/",
  [PermissionMiddleware, Can("purchases", "manage"), PurchaseValidator],
  async (req: Request, res: Response) => {
    await RecordPurchaseController(
      {
        ...req.body,
        churchId: req.auth.churchId,
        file: req.files.invoice,
        createdBy: req.auth.name,
      },
      res
    )
  }
)

purchaseRouter.get(
  "/",
  [PermissionMiddleware, Can("purchases", "read")],
  async (req: Request, res: Response) => {
    await listPurchasesController(
      {
        ...req.query,
        churchId: req.auth.churchId,
      } as FilterPurchasesRequest,
      res
    )
  }
)

export default purchaseRouter
