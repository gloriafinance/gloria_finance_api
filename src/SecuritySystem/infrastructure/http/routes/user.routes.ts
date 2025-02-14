import { Router } from "express"
import {
  recoveryPassword,
  UserController,
  userLoginPayload,
} from "../controllers/user.controller"
import { CreateUserRequest, FilterUserRequest } from "../../../domain"
import { PermissionMiddleware } from "../../../../Shared/infrastructure"
import { ChangePasswordController } from "../controllers/changePassword.controller"

const userRoutes = Router()

userRoutes.get("/", PermissionMiddleware, async (req, res) => {
  await UserController.fetchAllUser(
    req.query as unknown as FilterUserRequest,
    res
  )
})

userRoutes.post("/create", PermissionMiddleware, async (req, res) => {
  await UserController.createOrUpdateUser(
    req.body as unknown as CreateUserRequest,
    res
  )
})

userRoutes.put("/edit-user/:userId", PermissionMiddleware, async (req, res) => {
  await UserController.createOrUpdateUser(
    {
      ...(req.body as unknown as CreateUserRequest),
      userId: req.params.userId,
    },
    res
  )
})

userRoutes.post("/login", async (req, res) => {
  await UserController.login(req.body as unknown as userLoginPayload, res)
})

userRoutes.post("/recovery-password", async (req, res) => {
  await recoveryPassword(req.body.email, res)
})

userRoutes.post("/change-password", async (req, res) => {
  await ChangePasswordController(req.body, res)
})

export default userRoutes
