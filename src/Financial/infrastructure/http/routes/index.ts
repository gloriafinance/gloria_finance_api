import { Router } from "express"
import financialRecordRoutes from "./FinancialRecord.routes"
import financialJobRoute from "./FinancialRecordJob.routes"

const financialRouter = Router()

financialRouter.use("/tools", financialJobRoute)
financialRouter.use("/financial-record", financialRecordRoutes)

export default financialRouter
