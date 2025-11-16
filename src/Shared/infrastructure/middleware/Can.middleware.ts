import { NextFunction, Request, Response } from "express"
import { BASE_PERMISSIONS } from "@/SecuritySystem/domain"

type AuthenticatedRequest = Request & {
  auth?: {
    permissions?: string[]
  }
  requiredPermission?: string
}

export function Can(module: string, action: string | string[]) {
  const actions = Array.isArray(action) ? action : [action]
  const permissionKeys = actions.map((actionName) => `${module}:${actionName}`)
  const moduleWildcard = `${module}:*`
  const permissionDescriptions = permissionKeys
    .map((key) => PERMISSION_DESCRIPTION.get(key))
    .filter((description): description is string => Boolean(description))

  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): void => {
    const auth = req.auth

    if (!auth) {
      res.status(401).send({ message: "Unauthorized." })
      return
    }

    const permissions = auth.permissions ?? []
    const matchedPermission = permissions.includes(moduleWildcard)
      ? moduleWildcard
      : permissionKeys.find((key) => permissions.includes(key))

    if (!matchedPermission) {
      const permissionDescription =
        permissionDescriptions.length === 0
          ? undefined
          : permissionDescriptions.join(", ")

      res.status(403).send({
        message: permissionDescription
          ? actions.length > 1
            ? "Acesso negado. Você precisa de pelo menos uma das permissões listadas para continuar."
            : "Acesso negado. Você precisa da permissão listada para continuar."
          : "Acesso negado.",
        requiredPermission:
          permissionKeys.length === 1
            ? permissionKeys[0]
            : permissionKeys.join(" | "),
        permissionDescription,
      })
      return
    }

    req.requiredPermission = matchedPermission

    next()
  }
}

const PERMISSION_DESCRIPTION = new Map(
  BASE_PERMISSIONS.map((permission) => [
    `${permission.module}:${permission.action}`,
    permission.description,
  ])
)
