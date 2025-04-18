import { Router } from "express"
import AccountsPayableRoute from "./AccountsPayable.route"
import supplierRoute from "./Supplier.route"

const accountsPayableRoutes = Router()

accountsPayableRoutes.use("/", AccountsPayableRoute)
accountsPayableRoutes.use("/supplier", supplierRoute)

export default accountsPayableRoutes
