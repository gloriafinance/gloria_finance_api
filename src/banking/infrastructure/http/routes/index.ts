import { Router } from "express"
import bankStatementRoutes from "@/banking/infrastructure/http/routes/BankStatement.routes"
import bankRoute from "@/banking/infrastructure/http/routes/Bank.routes"

const bankingRoutes = Router()

bankingRoutes.use("/", bankRoute)
bankingRoutes.use("/statements", bankStatementRoutes)

export default bankingRoutes
