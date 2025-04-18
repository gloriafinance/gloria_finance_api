import "dotenv/config"

import churchRouters from "@/Church/infrastructure/http/routes/Church.routers"
import memberRouters from "@/Church/infrastructure/http/routes/Member.routers"
import financialRouter from "@/Financial/infrastructure/http/routes"

import worldRoute from "@/World/infrastructure/http/routes/World.route"
import ministerRoute from "@/Church/infrastructure/http/routes/Minsiter.routers"
import { Express } from "express"
import { Schedule, StartQueueService } from "@/Shared/infrastructure"
import { Queues } from "@/queues"
import userRoutes from "@/SecuritySystem/infrastructure/http/routes/user.routes"
import reportsRouter from "@/Reports/infrastructure/http/routes"
import purchaseRouter from "@/Purchases/infrastructure/http/routes"
import { server, startServer } from "@/Shared/infrastructure/http/server"
import accountsReceivableRoutes from "@/AccountsReceivable/infrastructure/http/AccountsReceivable.routes"
import groupAccountsPayableRoutes from "@/AccountsPayable/infrastructure/http/routes"

export const APP_DIR = __dirname

const port = Number(process.env.APP_PORT) || 8080
const app: Express = server(port)

StartQueueService(app, Queues)

app.use("/api/v1/church", churchRouters)
app.use("/api/v1/church/member", memberRouters)
app.use("/api/v1/minister", ministerRoute)
app.use("/api/v1/finance", financialRouter)
app.use("/api/v1/account-receivable", accountsReceivableRoutes)
app.use("/api/v1/account-payable", groupAccountsPayableRoutes)
app.use("/api/v1/user", userRoutes)
app.use("/api/v1/world", worldRoute)
app.use("/api/v1/reports", reportsRouter)
app.use("/api/v1/purchase", purchaseRouter)

//StorageGCP.getInstance(process.env.BUCKET_FILES);

Schedule()

startServer(app, port)
