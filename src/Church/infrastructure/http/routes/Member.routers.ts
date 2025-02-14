import { MemberController } from "../controllers/Member.controller"
import { MemberPaginateRequest, MemberRequest } from "../../../domain"
import { Router } from "express"
import { PermissionMiddleware } from "../../../../Shared/infrastructure"

const memberRoute = Router()

memberRoute.post("/", PermissionMiddleware, async (req, res) => {
  await MemberController.createOrUpdate(req.body as MemberRequest, res)
})

memberRoute.get("/list", PermissionMiddleware, async (req, res) => {
  const params = req.query as unknown as MemberPaginateRequest
  await MemberController.list(params, res)
})

memberRoute.get("/:memberId", PermissionMiddleware, async (req, res) => {
  await MemberController.findById(req.params.memberId, res)
})

export default memberRoute
