import { Request, Response, Router } from "express"
import { PermissionMiddleware } from "@/Shared/infrastructure"
import RegisterSupplierValidator from "@/AccountsPayable/infrastructure/http/validators/RegisterSupplier.validator"
import { SupplierController } from "../controllers"

const supplierRoute = Router()

supplierRoute.post(
  "/",
  [PermissionMiddleware, RegisterSupplierValidator],
  async (req: Request, res: Response) => {
    await SupplierController.registerSupplier(
      { ...req.body, churchId: req["user"].churchId },
      res
    )
  }
)

supplierRoute.get(
  "/",
  PermissionMiddleware,
  async (req: Request, res: Response) => {
    await SupplierController.listSupplier(req["user"].churchId, res)
  }
)

export default supplierRoute
