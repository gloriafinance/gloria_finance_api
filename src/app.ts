import "reflect-metadata"
import {
  BootstrapServer,
  CorsModule,
  FileUploadModule,
  RateLimitModule,
  RequestContextModule,
  ServerRuntime,
} from "@abejarano/ts-express-server"

import { controllersModule } from "./bootstrap"
import { FactoryService } from "./bootstrap/FactoryService"
import { StartQueueService } from "@/Shared/infrastructure"
import { Queues } from "./queues"
import { FinancialSchedules } from "./Financial/infrastructure/schedules"

export const APP_DIR = __dirname

const server = new BootstrapServer(Number(Number(process.env.APP_PORT || 8080)))

server.addModules([
  new CorsModule({
    allowedHeaders: ["content-type", "authorization"],
  }),
  new RequestContextModule(),
  new RateLimitModule(),
  new FileUploadModule({
    maxFiles: 1,
    allowedMimeTypes: [
      "image/*",
      "application/pdf",
      "text/csv",
      "application/csv",
      "application/vnd.ms-excel",
    ],
  }),
  controllersModule(),
])

server.addServices([new FactoryService()])

server.getApp().set?.("trustProxy", ["127.0.0.1/8"])
StartQueueService(server.getApp(), Queues())
server.start().then(() => FinancialSchedules())
