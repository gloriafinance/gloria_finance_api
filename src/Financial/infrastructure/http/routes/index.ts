import { Router } from "express"
import financeContribution from "./FinanceContribution.routes"
import financialRecordRoutes from "./FinancialRecord.routes"
import financialJobRoute from "./FinancialRecordJob.routes"

const financialRouter = Router()

financialRouter.use("/tools", financialJobRoute)
financialRouter.use("/contributions", financeContribution)
financialRouter.use("/financial-record", financialRecordRoutes)

export default financialRouter
