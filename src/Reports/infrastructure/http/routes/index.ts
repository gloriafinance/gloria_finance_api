import { Router } from "express"
import reportFinanceRouter from "./FinanceReports.router"

const reportsRouter = Router()

reportsRouter.use("/finance", reportFinanceRouter)

export default reportsRouter
