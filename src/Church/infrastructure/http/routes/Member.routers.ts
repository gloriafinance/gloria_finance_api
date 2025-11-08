import { MemberController } from "../controllers/Member.controller"
import { MemberPaginateRequest, MemberRequest } from "../../../domain"
import { Router } from "express"
import { PermissionMiddleware, Can } from "@/Shared/infrastructure"

const memberRoute = Router()

memberRoute.post(
  "/",
  PermissionMiddleware,
  Can("members", "manage"),
  async (req, res) => {
    await MemberController.createOrUpdate(req.body as MemberRequest, res)
  }
)

memberRoute.get(
  "/list",
  PermissionMiddleware,
  Can("members", "manage"),
  async (req, res) => {
    const params = req.query as unknown as MemberPaginateRequest
    await MemberController.list(params, res)
  }
)

memberRoute.get(
  "/all",
  PermissionMiddleware,
  Can("members", "manage"),
  async (req, res) => {
    await MemberController.all(req["user"].churchId, res)
  }
)

memberRoute.get(
  "/:memberId",
  PermissionMiddleware,
  Can("members", "manage"),
  async (req, res) => {
    await MemberController.findById(req.params.memberId, res)
  }
)

export default memberRoute
