import { Router } from "express"
import { PermissionMiddleware, Can } from "../../../../Shared/infrastructure"
import AssignChurchValidator from "../validators/AssignChurch.validator"
import { MinisterController } from "../controllers/Minister.controller"
import { MinisterRequest } from "../../../domain"
import MinisterValidator from "../validators/Mininister.validator"

const ministerRoute = Router()

ministerRoute.post(
  "/",
  [PermissionMiddleware, Can("ministers", "manage"), MinisterValidator],
  async (req, res): Promise<void> => {
    await MinisterController.createOrUpdate(req.body as MinisterRequest, res)
  }
)

ministerRoute.post(
  "/assign-church",
  [PermissionMiddleware, Can("ministers", "manage"), AssignChurchValidator],
  async (req, res): Promise<void> => {
    await MinisterController.assignChurch(
      req.body as { churchId: string; ministerId: string },
      res
    )
  }
)

export default ministerRoute
