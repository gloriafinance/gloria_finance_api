import "reflect-metadata"
import "dotenv/config"

import churchRouters from "./Church/infrastructure/http/routes/Church.routers"
import memberRouters from "./Church/infrastructure/http/routes/Member.routers"
import financialRouter from "./Financial/infrastructure/http/routes"

import worldRoute from "./World/infrastructure/http/routes/World.route"
import ministerRoute from "./Church/infrastructure/http/routes/Minsiter.routers"
import { Express } from "express"
import { Schedule, server } from "./Shared/infrastructure"
import { Queues } from "./queues"
import { BullBoard } from "./Shared/infrastructure/bull/bullBoard"
import userRoutes from "./SecuritySystem/infrastructure/http/routes/user.routes"
import { Logger } from "./Shared/adapter"
import reportsRouter from "./Reports/http/routes"

export const APP_DIR = __dirname

const port = Number(process.env.APP_PORT) || 8080
const app: Express = server(port)
const logger = Logger("AppServer")

BullBoard(app, Queues)

app.use("/api/v1/church", churchRouters)
app.use("/api/v1/church/member", memberRouters)
app.use("/api/v1/minister", ministerRoute)
app.use("/api/v1/finance", financialRouter)
app.use("/api/v1/user", userRoutes)
app.use("/api/v1/world", worldRoute)
app.use("/api/v1/reports", reportsRouter)

//StorageGCP.getInstance(process.env.BUCKET_FILES);

Schedule()

const serverInstance = app.listen(port, () =>
  logger.info(`server running on port ${port}`)
)

process.on("SIGINT", () => {
  logger.info("Recibida señal SIGINT. Cerrando servidor...")
  serverInstance.close(() => {
    logger.info("Servidor cerrado.")
    process.exit(0)
  })
})

process.on("SIGTERM", () => {
  logger.info("Recibida señal SIGTERM. Cerrando servidor...")
  serverInstance.close(() => {
    logger.info("Servidor cerrado.")
    process.exit(0)
  })
})
