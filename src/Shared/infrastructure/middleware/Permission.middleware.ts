import jwt from "jsonwebtoken"
import { AuthorizationService } from "@/SecuritySystem/applications/rbac/AuthorizationService"
import {
  PermissionMongoRepository,
  RolePermissionMongoRepository,
  UserAssignmentMongoRepository,
} from "@/SecuritySystem/infrastructure"
import { type AuthTokenPayload } from "@/SecuritySystem/infrastructure/adapters/AuthToken.adapter"
import { CacheProviderService } from "@/Shared/infrastructure/services/CacheProvider.service"
import type {
  NextFunction,
  ServerRequest,
  ServerResponse,
} from "bun-platform-kit"
import { Logger } from "@/Shared/adapter"

const authorizationService = AuthorizationService.getInstance(
  UserAssignmentMongoRepository.getInstance(),
  RolePermissionMongoRepository.getInstance(),
  PermissionMongoRepository.getInstance(),
  CacheProviderService.getInstance()
)

export const PermissionMiddleware = async (
  req: ServerRequest,
  res: ServerResponse,
  next: NextFunction
) => {
  const authHeader = req.headers["authorization"] as string
  const logger = Logger("PermissionMiddleware")

  const token = authHeader && authHeader.split(" ")[1]

  if (!token) {
    return res
      .status(401)
      .send({ message: "Access denied. Token not provided." })
  }

  try {
    const payload = jwt.verify(
      token,
      process.env.JWT_SECRET!
    ) as unknown as AuthTokenPayload

    if (!payload?.userId || !payload?.churchId) {
      logger.error(`Token payload missing scope information. ${payload}`)
      return res.status(403).send({
        message: "Token payload missing scope information.",
      })
    }

    const { roles, permissions } =
      await authorizationService.resolveAuthorization(
        payload.churchId,
        payload.userId
      )

    // @ts-ignore
    req["auth"] = {
      ...payload,
      roles,
      permissions,
    }

    //res.locals.auth = authContext

    next()
  } catch (error: any) {
    logger.error(JSON.stringify(error))
    return res.status(401).send({ message: "Unauthorized." })
  }
}
