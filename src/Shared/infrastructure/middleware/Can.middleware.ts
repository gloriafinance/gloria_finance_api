import { NextFunction, Request, Response } from "express"
import { PermissionDescriptionResolver } from "@/Shared/infrastructure"
import { HttpStatus } from "@/Shared/domain"

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
  const permissionDescriptionResolver =
    PermissionDescriptionResolver.getInstance()

  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const auth = req.auth

      if (!auth) {
        res.status(HttpStatus.UNAUTHORIZED).send({ message: "Unauthorized." })
        return
      }

      const permissions = auth.permissions ?? []
      const matchedPermission = permissions.includes(moduleWildcard)
        ? moduleWildcard
        : permissionKeys.find((key) => permissions.includes(key))

      if (!matchedPermission) {
        const permissionDescriptions =
          await permissionDescriptionResolver.resolveDescriptions(
            module,
            actions
          )
        const permissionDescription = permissionDescriptions.length
          ? permissionDescriptions.join(", ")
          : undefined

        res.status(HttpStatus.FORBIDDEN).send({
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
    } catch (error) {
      next(error)
    }
  }
}
