import jwt = require("jsonwebtoken")
import { AuthorizationService } from "@/SecuritySystem/applications/rbac/AuthorizationService"
import {
  PermissionMongoRepository,
  RolePermissionMongoRepository,
  UserAssignmentMongoRepository,
} from "@/SecuritySystem/infrastructure"
import { UserPermissionsCache } from "@/Shared/infrastructure/cache/UserPermissionsCache"
import { AuthTokenPayload } from "@/SecuritySystem/infrastructure/adapters/AuthToken.adapter"

const authorizationService = AuthorizationService.getInstance(
  UserAssignmentMongoRepository.getInstance(),
  RolePermissionMongoRepository.getInstance(),
  PermissionMongoRepository.getInstance(),
  UserPermissionsCache.getInstance()
)

export const PermissionMiddleware = async (req, res, next) => {
  const authHeader = req.headers["authorization"]

  const token = authHeader && authHeader.split(" ")[1]

  if (!token) {
    return res
      .status(401)
      .send({ message: "Access denied. Token not provided." })
  }

  try {
    const payload = jwt.verify(
      token,
      process.env.JWT_SECRET
    ) as AuthTokenPayload

    if (!payload?.userId || !payload?.churchId) {
      return res.status(403).send({
        message: "Token payload missing scope information.",
      })
    }

    const { roles, permissions } =
      await authorizationService.resolveAuthorization(
        payload.churchId,
        payload.userId
      )

    const authContext = {
      ...payload,
      roles,
      permissions,
    }

    req.auth = authContext
    req["auth"] = authContext
    req["user"] = authContext
    res.locals.auth = authContext

    next()
  } catch (error) {
    return res.status(401).send({ message: "Unauthorized." })
  }
}
