import { Request, Response, Router } from "express"
import { PermissionMiddleware, Can } from "@/Shared/infrastructure"
import RegisterSupplierValidator from "@/AccountsPayable/infrastructure/http/validators/RegisterSupplier.validator"
import { SupplierController } from "../controllers"

const supplierRoute = Router()

supplierRoute.post(
  "/",
  [
    PermissionMiddleware,
    Can("accounts_payable", "suppliers_manage"),
    RegisterSupplierValidator,
  ],
  async (req: Request, res: Response) => {
    await SupplierController.registerSupplier(
      { ...req.body, churchId: req.auth.churchId },
      res
    )
  }
)

supplierRoute.get(
  "/",
  PermissionMiddleware,
  Can("accounts_payable", "suppliers_manage"),
  async (req: Request, res: Response) => {
    await SupplierController.listSupplier(req.auth.churchId, res)
  }
)

export default supplierRoute
