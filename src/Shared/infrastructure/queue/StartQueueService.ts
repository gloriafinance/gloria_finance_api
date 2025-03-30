import { Express } from "express"
import { ExpressAdapter } from "@bull-board/express"
import { createBullBoard } from "@bull-board/api"
import { BullAdapter } from "@bull-board/api/bullAdapter"
import { IDefinitionQueue } from "../../domain"
import * as basicAuth from "express-basic-auth"
import { QueueService } from "@/Shared/infrastructure/queue/QueueService"

export const StartQueueService = async (
  app: Express,
  Queues: IDefinitionQueue[]
) => {
  const serverAdapter = new ExpressAdapter()
  serverAdapter.setBasePath("/ui/queues")

  const queueService = QueueService.getInstance()

  await queueService.initialize(Queues)

  // Obtener las colas del registro a través del facade QueueService
  const queueRegistry = queueService["registry"] // Acceso interno para configuración
  const queues = queueRegistry.getAllQueues()

  createBullBoard({
    queues: queues.map((queue) => new BullAdapter(queue)),
    serverAdapter,
    options: {
      uiConfig: {
        boardTitle: "My BOARD",
      },
    },
  })

  // Middleware para autenticación básica
  app.use(
    "/ui/queues",
    basicAuth({
      users: { [process.env.BULL_USER]: process.env.BULL_PASS },
      challenge: true,
      unauthorizedResponse: "No autorizado",
    })
  )

  app.use("/ui/queues", serverAdapter.getRouter())
}
