import { Router } from "express"
import AccountsPayableRoute from "./AccountsPayable.route"
import supplierRoute from "./Supplier.route"

const groupAccountsPayableRoutes = Router()

groupAccountsPayableRoutes.use("/", AccountsPayableRoute)
groupAccountsPayableRoutes.use("/supplier", supplierRoute)

export default groupAccountsPayableRoutes
