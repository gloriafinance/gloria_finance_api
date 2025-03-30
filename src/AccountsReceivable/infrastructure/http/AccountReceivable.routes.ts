import { Router } from "express"

import { PermissionMiddleware } from "@/Shared/infrastructure"
import { CreateAccountReceivableController } from "./controllers"
import { ListAccountReceivableController } from "@/AccountsReceivable/infrastructure/http/controllers/ListAccountReceivable.controller"
import { FilterAccountReceivableRequest } from "@/AccountsReceivable/domain"

const accountReceivableRoutes = Router()

accountReceivableRoutes.post("/", PermissionMiddleware, async (req, res) => {
  await CreateAccountReceivableController(req.body, res)
})

accountReceivableRoutes.get("", PermissionMiddleware, async (req, res) => {
  await ListAccountReceivableController(
    { ...(req.query as unknown as FilterAccountReceivableRequest) },
    res
  )
})

export default accountReceivableRoutes
