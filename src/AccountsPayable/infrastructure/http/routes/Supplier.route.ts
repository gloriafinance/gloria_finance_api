import { Request, Response, Router } from "express"
import { PermissionMiddleware } from "@/Shared/infrastructure"
import { RegisterSupplierController } from "@/AccountsPayable/infrastructure/http/controllers"
import RegisterSupplierValidator from "@/AccountsPayable/infrastructure/http/validators/RegisterSupplier.validator"
import { ListSupplierController } from "@/AccountsPayable/infrastructure/http/controllers/ListSupplier.controller"

const supplierRoute = Router()

supplierRoute.post(
  "/",
  [PermissionMiddleware, RegisterSupplierValidator],
  async (req: Request, res: Response) => {
    await RegisterSupplierController(
      { ...req.body, churchId: req["user"].churchId },
      res
    )
  }
)

supplierRoute.get(
  "/",
  PermissionMiddleware,
  async (req: Request, res: Response) => {
    await ListSupplierController(req["user"].churchId, res)
  }
)

export default supplierRoute
