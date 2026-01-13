import "reflect-metadata"
import "dotenv/config"
import {
  BootstrapStandardServer,
  CorsModule,
} from "@abejarano/ts-express-server"
import { Queues } from "@/queues"
import { controllersModule, routerModule } from "@/bootstrap"
import { FactoryService } from "@/bootstrap/FactoryService"
import { ServerSocketService } from "@/bootstrap/ServerSocketService"
import { FinancialSchedules } from "@/Financial/infrastructure/schedules"
import { StartQueueService } from "@/Shared/infrastructure"
import { Express } from "express"

export const APP_DIR = __dirname

const server = BootstrapStandardServer(
  Number(process.env.APP_PORT || 8080),
  routerModule(),
  controllersModule()
)
server.addModule(
  new CorsModule({
    origin: "*",
  })
)
StartQueueService(server.getApp() as unknown as Express, Queues())

server.addServices([new FactoryService(), new ServerSocketService()])

server.start().then(() => FinancialSchedules())
