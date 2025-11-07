import { Router } from "express"
import bankRoute from "@/Banking/infrastructure/http/routes/Bank.routes"
import bankStatementRoutes from "./BankStatement.routes"

const bankingRoutes = Router()

bankingRoutes.use("/statements", bankStatementRoutes)
bankingRoutes.use("/", bankRoute)

export default bankingRoutes
