import helmet from "helmet"
import rateLimit from "express-rate-limit"
import { Logger, RequestContext } from "@/Shared/adapter"
import { v4 } from "uuid"
import { Express } from "express"
import { MongoClientFactory } from "@/Shared/infrastructure"
import { QueueService } from "@/Shared/infrastructure/queue/QueueService"
import cors = require("cors")
import express = require("express")
import fileUpload = require("express-fileupload")
import bodyParser = require("body-parser")

const requestContextMiddleware = (req, res, next) => {
  const requestId = (req.headers["x-request-id"] as string) || v4()

  RequestContext.run({ requestId }, () => {
    next()
  })
}

export function server(port: number) {
  const app = express()
  app.use(express.json())
  app.use(bodyParser.urlencoded({ extended: true }))
  app.disable("x-powered-by")

  const corsOptions = {
    origin: "*",
    preflightContinue: false,
    optionsSuccessStatus: 204,
  }

  app.use(cors(corsOptions))

  app.use(
    helmet({
      xXssProtection: true,
    })
  )

  const limiter = rateLimit({
    windowMs: 8 * 60 * 1000, // 15 minutes
    limit: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    skip: (req) => {
      // Excluye las rutas de @bull-board/express
      return req.originalUrl.startsWith("/ui/queues")
    },
  })

  app.use(limiter)

  app.use(
    fileUpload({
      limits: { fileSize: 50 * 1024 * 1024 },
      useTempFiles: true,
      tempFileDir: "/tmp/",
    })
  )

  app.set("port", port)

  app.use(requestContextMiddleware)

  return app
}

async function gracefulShutdown(serverInstance) {
  const queueService = QueueService.getInstance()

  const logger = Logger("AppServer")

  try {
    // 1. Detener aceptación de nuevos trabajos
    logger.info("Closing queue system...")
    await queueService.shutdown()

    // 2. Cerrar conexiones a bases de datos
    logger.info("Closing MongoDB connections...")
    await MongoClientFactory.closeClient()

    // 3. Cerrar servidor HTTP
    logger.info("Closing HTTP server...")
    if (serverInstance) {
      await new Promise((resolve) => {
        serverInstance.close(resolve)
      })
    }

    logger.info("Graceful shutdown completed. Exiting...")
    process.exit(0)
  } catch (error) {
    logger.error("Error during graceful shutdown:", error)
    process.exit(1)
  }
}

export const startServer = (app: Express, port: number) => {
  const logger = Logger("AppServer")

  const serverInstance = app.listen(port, () =>
    logger.info(`server running on port ${port}`)
  )

  process.on("SIGINT", async () => {
    logger.info("SIGINT signal received. Shutting down application...")
    await gracefulShutdown(serverInstance)
  })

  process.on("SIGTERM", async () => {
    logger.info("SIGTERM signal received. Shutting down application...")
    await gracefulShutdown(serverInstance)
  })
}
