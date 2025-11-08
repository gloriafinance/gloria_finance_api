import { ChurchController } from "../controllers/Church.controller"
import { ChurchPaginateRequest, ChurchRequest } from "../../../domain"
import { Router } from "express"
import { Can, PermissionMiddleware } from "@/Shared/infrastructure"

const churchRoute = Router()

churchRoute.post(
  "/",
  PermissionMiddleware,
  Can("church", "upsert"),
  async (req, res) => {
    await ChurchController.createOrUpdate(req.body as ChurchRequest, res)
  }
)

churchRoute.get("/", PermissionMiddleware, async (req, res) => {
  const params = req.query as unknown as ChurchPaginateRequest
  await ChurchController.list(params, res)
})

churchRoute.get(
  "/list/by-district-id",
  PermissionMiddleware,
  Can("church", "search"),
  async (req, res) => {
    const { districtId } = req.params as any
    await ChurchController.listByDistrictId(districtId, res)
  }
)

churchRoute.get(
  "/without-assigned-minister",
  PermissionMiddleware,
  Can("church", "search"),
  async (req, res) => {
    const params = req.query as unknown as ChurchPaginateRequest
    await ChurchController.listWithoutAssignedMinister(res)
  }
)

churchRoute.post(
  "/remove-minister/:churchId",
  PermissionMiddleware,
  Can("ministers", "manage"),
  async (req, res) => {
    await ChurchController.removeMinister(req.params.churchId, res)
  }
)

churchRoute.get(
  "/:churchId",
  PermissionMiddleware,
  Can("church", "search"),
  async (req, res) => {
    await ChurchController.findByChurchId(req.params.churchId, res)
  }
)

export default churchRoute
