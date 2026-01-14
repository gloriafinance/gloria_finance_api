import "reflect-metadata"
import {
  BootstrapServer,
  CorsModule,
  FileUploadModule,
  ServerRuntime,
} from "@abejarano/ts-express-server"

import { controllersModule } from "./bootstrap"
import { FactoryService } from "./bootstrap/FactoryService"
import { StartQueueService } from "@/Shared/infrastructure"
import { Queues } from "./queues"
import { FinancialSchedules } from "./Financial/infrastructure/schedules"

export const APP_DIR = __dirname

const bootstrap = async () => {
  const server = new BootstrapServer(
    Number(Number(process.env.APP_PORT || 8080))
  )

  server.addModules([
    new CorsModule({
      allowedHeaders: ["content-type", "authorization"],
    }),
    controllersModule(),
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
  ])

  server.addServices([new FactoryService()])

  server.getApp().set?.("trustProxy", ["127.0.0.1/8"])
  await StartQueueService(server.getApp(), Queues())
  server.start().then(() => FinancialSchedules())
}

bootstrap().catch((error) => {
  console.error("Failed to start server:", error)
  process.exit(1)
})
