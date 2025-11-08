import { NextFunction, Request, Response } from "express"

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

  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const auth = req.auth ?? req.user

    if (!auth) {
      res.status(401).send({ message: "Unauthorized." })
      return
    }

    const permissions = auth.permissions ?? []
    const isAllowed =
      permissions.includes(permissionKey) || permissions.includes(moduleWildcard)

    if (!isAllowed) {
      res.status(403).send({
        message: "Forbidden.",
        requiredPermission: permissionKey,
      })
      return
    }

    req.requiredPermission = permissionKey

    next()
  }
}
