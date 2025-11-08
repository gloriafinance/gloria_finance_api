import { Router } from "express"
import { findByCountryIdController } from "../controllers/State.controller"
import { PermissionMiddleware, Can } from "@/Shared/infrastructure"

const worldRoute = Router()

worldRoute.get(
  "/states/:countryId",
  PermissionMiddleware,
  Can("world", "states_read"),
  async (req, res) => {
    await findByCountryIdController(req.params.countryId, res)
  }
)

export default worldRoute
