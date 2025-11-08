import "reflect-metadata"
import "dotenv/config"
import { Schedule, StartQueueService } from "@/Shared/infrastructure"
import { BootstrapStandardServer } from "@abejarano/ts-express-server"
import { Queues } from "@/queues"
import { routerModule } from "@/bootstrap"
import { FactoryService } from "@/bootstrap/FactoryService"
import { ServerSocketService } from "@/bootstrap/ServerSocketService"

export const APP_DIR = __dirname

const server = BootstrapStandardServer(
  Number(process.env.APP_PORT || 8080),
  routerModule()
)

StartQueueService(server.getApp(), Queues())

server.addServices([new FactoryService(), new ServerSocketService()])

server.start().then(() => Schedule())
