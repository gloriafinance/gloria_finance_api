import { createBullBoard } from "@bull-board/api"
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter"
import { BunAdapter } from "@bull-board/bun"
import type { IListQueue } from "../domain"
import { QueueService } from "./QueueService.ts"
import type { ServerApp } from "bun-platform-kit"

type BunRoutes = ReturnType<BunAdapter["getRoutes"]>

const normalizePath = (value: string): string => {
  if (!value) {
    return "/"
  }

  const normalized = value.startsWith("/") ? value : `/${value}`
  return normalized !== "/" ? normalized.replace(/\/+$/, "") : normalized
}

const extractParamsFromPattern = (
  routePattern: string,
  requestPath: string
): Record<string, string> | undefined => {
  const normalizedPattern = normalizePath(routePattern)
  const normalizedPath = normalizePath(requestPath)

  if (normalizedPattern === normalizedPath) {
    return {}
  }

  if (normalizedPattern.endsWith("/*")) {
    const prefix = normalizedPattern.slice(0, -2)
    if (normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`)) {
      return {}
    }
    return undefined
  }

  const patternParts = normalizedPattern.split("/").filter(Boolean)
  const pathParts = normalizedPath.split("/").filter(Boolean)

  if (patternParts.length !== pathParts.length) {
    return undefined
  }

  const params: Record<string, string> = {}

  for (const [index, patternPart] of patternParts.entries()) {
    const pathPart = pathParts[index]
    if (pathPart === undefined) {
      return undefined
    }

    if (patternPart.startsWith(":")) {
      params[patternPart.slice(1)] = decodeURIComponent(pathPart)
      continue
    }

    if (patternPart !== pathPart) {
      return undefined
    }
  }

  return params
}

const findRouteHandler = (routes: BunRoutes, method: string, path: string) => {
  const handlers = routes[path]
  if (handlers && handlers[method]) {
    return {
      handler: handlers[method],
      params: {} as Record<string, string>,
    }
  }

  for (const [routePath, routeHandlers] of Object.entries(routes)) {
    if (!routeHandlers[method]) {
      continue
    }

    const params = extractParamsFromPattern(routePath, path)
    if (params) {
      return {
        handler: routeHandlers[method],
        params,
      }
    }
  }

  return undefined
}

const registerBunRoutes = (
  app: ServerApp,
  basePath: string,
  routes: BunRoutes,
  credentials?: {
    user: string
    password: string
  }
) => {
  const user = credentials?.user || ""
  const pass = credentials?.password || ""
  const hasAuth = user.length > 0 && pass.length > 0

  app.use(basePath, async (req: any, res: any, next: () => void) => {
    if (hasAuth) {
      const authorization =
        req?.headers?.authorization || req?.headers?.Authorization
      const token = String(authorization || "")

      if (!token.startsWith("Basic ")) {
        res.status(401)
        res.set("WWW-Authenticate", 'Basic realm="Queues"')
        res.send({ message: "Unauthorized" })
        return
      }

      const encoded = token.slice("Basic ".length).trim()
      const decoded = Buffer.from(encoded, "base64").toString("utf-8")
      const [authUser, authPass] = decoded.split(":")

      if (authUser !== user || authPass !== pass) {
        res.status(401)
        res.set("WWW-Authenticate", 'Basic realm="Queues"')
        res.send({ message: "Unauthorized" })
        return
      }
    }

    const method = String(req.method || "").toUpperCase()
    const path = String(req.path || "")
    const route = findRouteHandler(routes, method, path)

    if (!route) {
      next()
      return
    }

    const rawRequest = req.raw as Request
    const requestWithParams = new Proxy(rawRequest as Request & any, {
      get(target, property, receiver) {
        if (property === "params") {
          return route.params
        }
        return Reflect.get(target, property, receiver)
      },
    })

    const response = await route.handler(requestWithParams as Request)
    res.send(response)
  })
}

export const StartQueueService = async (params: {
  app?: ServerApp
  listQueues: IListQueue[]
  credentials?: {
    user: string
    password: string
  }
}) => {
  const { app, listQueues, credentials } = params

  const queueService = QueueService.getInstance()
  await queueService.initialize(listQueues)

  if (app) {
    const queueRegistry = queueService["registry"]
    const queues = queueRegistry.getAllQueues()

    const serverAdapter = new BunAdapter()
    serverAdapter.setBasePath("/ui/queues")

    createBullBoard({
      queues: queues.map((q) => new BullMQAdapter(q)),
      serverAdapter,
      options: {
        uiConfig: { boardTitle: "My BOARD" },
      },
    })

    registerBunRoutes(app, "/ui/queues", serverAdapter.getRoutes(), credentials)
  }
}
