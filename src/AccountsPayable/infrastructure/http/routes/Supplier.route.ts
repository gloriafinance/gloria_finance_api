import { Request, Response, Router } from "express"
import { PermissionMiddleware } from "@/Shared/infrastructure"

const supplierRoute = Router()

supplierRoute.post(
  "/supplier",
  PermissionMiddleware,
  async (req: Request, res: Response) => {}
)
