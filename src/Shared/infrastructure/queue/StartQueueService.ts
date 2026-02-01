import { createBullBoard } from "@bull-board/api"
import { BullAdapter } from "@bull-board/api/bullAdapter"
import { BunAdapter } from "@bull-board/bun"
import type { ServerApp } from "bun-platform-kit"
import { QueueService } from "@/Shared/infrastructure/queue/QueueService"
import { IDefinitionQueue } from "@/Shared/domain"

type BunRoutes = ReturnType<BunAdapter["getRoutes"]>

const findRouteHandler = (routes: BunRoutes, method: string, path: string) => {
  const handlers = routes[path]
  if (handlers && handlers[method]) {
    return handlers[method]
  }

  for (const [routePath, routeHandlers] of Object.entries(routes)) {
    if (!routePath.endsWith("/*")) {
      continue
    }

    const prefix = routePath.slice(0, -1)
    if (path.startsWith(prefix) && routeHandlers[method]) {
      return routeHandlers[method]
    }
  }

  return undefined
}

const registerBunRoutes = (
  app: ServerApp,
  basePath: string,
  routes: BunRoutes
) => {
  const user = process.env.BULL_USER || ""
  const pass = process.env.BULL_PASS || ""
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
    const handler = findRouteHandler(routes, method, path)

    if (!handler) {
      next()
      return
    }

    const response = await handler(req.raw as Request)
    res.send(response)
  })
}

export const StartQueueService = async (
  app: ServerApp,
  Queues: IDefinitionQueue[]
) => {
  const serverAdapter = new BunAdapter()
  serverAdapter.setBasePath("/ui/queues")

  const queueService = QueueService.getInstance()
  await queueService.initialize(Queues)

  const queueRegistry = queueService["registry"]
  const queues = queueRegistry.getAllQueues()

  createBullBoard({
    queues: queues.map((q) => new BullAdapter(q)),
    serverAdapter,
    options: {
      uiConfig: { boardTitle: "My BOARD" },
    },
  })

  registerBunRoutes(app, "/ui/queues", serverAdapter.getRoutes())
}
