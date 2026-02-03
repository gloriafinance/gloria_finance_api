import "reflect-metadata"
import {
  BunKitServer,
  CorsModule,
  FileUploadModule,
  RateLimitModule,
  RequestContextModule,
  SecurityModule,
} from "bun-platform-kit"

import { controllersModule } from "./bootstrap"
import { FactoryService } from "./bootstrap/FactoryService"
import { StartQueueService } from "@/Shared/infrastructure"
import { Queues } from "./queues"
import { FinancialSchedules } from "./Financial/infrastructure/schedules"

export const APP_DIR = __dirname

const server = new BunKitServer(Number(Number(process.env.APP_PORT || 8080)))

server.addModules([
  new CorsModule({
    allowedHeaders: ["content-type", "authorization"],
  }),
  new SecurityModule(),
  new RequestContextModule(),
  new RateLimitModule(),
  new FileUploadModule({
    maxBodyBytes: Number(process.env.UPLOAD_MAX_BODY_BYTES ?? 25 * 1024 * 1024),
    maxFileBytes: Number(process.env.UPLOAD_MAX_FILE_BYTES ?? 25 * 1024 * 1024),
    maxFiles: 10,
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
StartQueueService({
  app: server.getApp(),
  listQueues: Queues(),
  credentials: {
    user: process.env.BULL_USER!,
    password: process.env.BULL_PASS!,
  },
})
server.start().then(() => FinancialSchedules())
