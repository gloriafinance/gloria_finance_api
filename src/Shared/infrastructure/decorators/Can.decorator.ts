import "reflect-metadata"
import { Request, Response, NextFunction } from "express"

export const PERMISSION_METADATA_KEY = "rbac:permission"

type AuthenticatedRequest = Request & { auth?: any; user?: any; requiredPermission?: string }

export function Can(module: string, action: string) {
  const permissionKey = `${module}:${action}`

  const guard = async (
    req: AuthenticatedRequest,
    res: Response,
    next?: NextFunction,
    onSuccess?: () => Promise<any> | any
  ) => {
    const auth = req?.auth ?? req?.user

    if (!auth) {
      res.status(401).send({ message: "Unauthorized." })
      return
    }

    const permissions: string[] = auth.permissions ?? []
    const moduleWildcard = `${module}:*`

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

    if (onSuccess) {
      return onSuccess()
    }

    if (typeof next === "function") {
      return next()
    }

    return
  }

  const decoratorOrMiddleware = function (...args: any[]) {
    const [first, second, third] = args

    const looksLikeRequest =
      first && typeof first === "object" && "headers" in first && "method" in first

    if (looksLikeRequest) {
      const req = first as AuthenticatedRequest
      const res = second as Response
      const next = third as NextFunction
      return guard(req, res, next)
    }

    const target = first
    const propertyKey = second as string
    const descriptor = third as PropertyDescriptor

    if (!descriptor || typeof descriptor.value !== "function") {
      throw new Error("@Can decorator can only be applied to methods")
    }

    const originalMethod = descriptor.value

    Reflect.defineMetadata(
      PERMISSION_METADATA_KEY,
      { module, action, permissionKey },
      originalMethod
    )

    descriptor.value = async function (...methodArgs: any[]) {
      const [req, res, next] = methodArgs as [
        AuthenticatedRequest,
        Response,
        NextFunction | undefined
      ]

      return guard(req, res, next, () => originalMethod.apply(this, methodArgs))
    }

    return descriptor
  }

  return decoratorOrMiddleware as unknown as (
    req: Request,
    res: Response,
    next: NextFunction
  ) => Promise<void> | void
}
