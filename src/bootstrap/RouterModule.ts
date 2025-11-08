import { RoutesModule } from "@abejarano/ts-express-server"
import churchRouters from "@/Church/infrastructure/http/routes/Church.routers"
import memberRouters from "@/Church/infrastructure/http/routes/Member.routers"
import ministerRoute from "@/Church/infrastructure/http/routes/Minsiter.routers"
import financialRouter from "@/Financial/infrastructure/http/routes"
import bankingRoutes from "@/Banking/infrastructure/http/routes"
import accountsReceivableRoutes from "@/AccountsReceivable/infrastructure/http/AccountsReceivable.routes"
import groupAccountsPayableRoutes from "@/AccountsPayable/infrastructure/http/routes"
import userRoutes from "@/SecuritySystem/infrastructure/http/routes/user.routes"
import worldRoute from "@/World/infrastructure/http/routes/World.route"
import reportsRouter from "@/Reports/infrastructure/http/routes"
import purchaseRouter from "@/Purchases/infrastructure/http/routes"
import patrimonyRouter from "@/Patrimony/infrastructure/http/routes/Asset.routes"
import rbacRouter from "@/SecuritySystem/infrastructure/http/routes/rbac.routes"

export const routerModule = () =>
  new RoutesModule([
    { path: "/api/v1/church", router: churchRouters },
    { path: "/api/v1/church/member", router: memberRouters },
    { path: "/api/v1/minister", router: ministerRoute },
    { path: "/api/v1/finance", router: financialRouter },
    { path: "/api/v1/bank", router: bankingRoutes },
    { path: "/api/v1/account-receivable", router: accountsReceivableRoutes },
    { path: "/api/v1/account-payable", router: groupAccountsPayableRoutes },
    { path: "/api/v1/user", router: userRoutes },
    { path: "/api/v1/world", router: worldRoute },
    { path: "/api/v1/reports", router: reportsRouter },
    { path: "/api/v1/purchase", router: purchaseRouter },
    { path: "/api/v1/patrimony", router: patrimonyRouter },
    { path: "/api/v1/rbac", router: rbacRouter },
  ])
