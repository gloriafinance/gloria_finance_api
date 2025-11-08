import { NextFunction, Request, Response } from "express"
import { BASE_PERMISSIONS } from "@/SecuritySystem/domain"

interface AuthContext {
  permissions?: string[]
}

type AuthenticatedRequest = Request & {
  auth?: AuthContext
  user?: AuthContext
  requiredPermission?: string
}

export function Can(module: string, action: string) {
  const permissionKey = `${module}:${action}`
  const moduleWildcard = `${module}:*`
  const permissionDescription = PERMISSION_DESCRIPTION.get(permissionKey)

  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): void => {
    const auth = req.auth ?? req.user

    if (!auth) {
      res.status(401).send({ message: "Unauthorized." })
      return
    }

    const permissions = auth.permissions ?? []
    const isAllowed =
      permissions.includes(permissionKey) ||
      permissions.includes(moduleWildcard)

    if (!isAllowed) {
      res.status(403).send({
        message: permissionDescription
          ? "Acesso negado. Você precisa da permissão listada para continuar."
          : "Acesso negado.",
        requiredPermission: permissionKey,
        permissionDescription,
      })
      return
    }

    req.requiredPermission = permissionKey

    next()
  }
}

const PERMISSION_DESCRIPTION = new Map(
  BASE_PERMISSIONS.map((permission) => [
    `${permission.module}:${permission.action}`,
    permission.description,
  ])
)
