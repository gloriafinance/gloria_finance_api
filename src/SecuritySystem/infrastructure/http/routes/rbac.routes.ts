import { Router } from "express"
import { Can, PermissionMiddleware } from "@/Shared/infrastructure"
import { RbacController } from "../controllers/rbac/Rbac.controller"

const rbacRouter = Router()
const controller = new RbacController()

rbacRouter.post(
  "/permissions/bootstrap",
  PermissionMiddleware,
  Can("rbac", "bootstrap"),
  controller.bootstrap.bind(controller)
)

rbacRouter.post(
  "/roles",
  PermissionMiddleware,
  Can("rbac", "manage_roles"),
  controller.createRole.bind(controller)
)

rbacRouter.post(
  "/roles/:id/permissions",
  PermissionMiddleware,
  Can("rbac", "manage_roles"),
  controller.assignPermissionsToRole.bind(controller)
)

rbacRouter.post(
  "/users/:id/assignments",
  PermissionMiddleware,
  Can("rbac", "assign_roles"),
  controller.assignRolesToUser.bind(controller)
)

rbacRouter.get(
  "/users/:id/permissions",
  PermissionMiddleware,
  Can("rbac", "read"),
  controller.getUserPermissions.bind(controller)
)

rbacRouter.get(
  "/roles",
  PermissionMiddleware,
  Can("rbac", "read"),
  controller.listRoles.bind(controller)
)

rbacRouter.get(
  "/permissions",
  PermissionMiddleware,
  Can("rbac", "read"),
  controller.listPermissions.bind(controller)
)

export default rbacRouter
