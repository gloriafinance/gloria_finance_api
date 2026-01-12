import { ControllersModule, RoutesModule } from "@abejarano/ts-express-server"
import churchRouters from "@/Church/infrastructure/http/routes/Church.routers"
import ministerRoute from "@/Church/infrastructure/http/routes/Minsiter.routers"
import financialRouter from "@/Financial/infrastructure/http/routes"
import bankingRoutes from "@/Banking/infrastructure/http/routes"
import groupAccountsPayableRoutes from "@/AccountsPayable/infrastructure/http/routes"
import worldRoute from "@/World/infrastructure/http/routes/World.route"
import reportsRouter from "@/Reports/infrastructure/http/routes"
import purchaseRouter from "@/Purchases/infrastructure/http/routes"
import patrimonyRouter from "@/Patrimony/infrastructure/http/routes/Asset.routes"
import rbacRouter from "@/SecuritySystem/infrastructure/http/routes/rbac.routes"
import { financialControllers } from "@/Financial/infrastructure/http/controllers"
import { consolidatedFinancialControllers } from "@/ConsolidatedFinancial/infrastructure/http/controllers"
import { UserController } from "@/SecuritySystem/infrastructure/http/controllers/User.controller"
import { financeConfigControllers } from "@/FinanceConfig/infrastructure/controllers"
import { scheduleControllers } from "@/Schedule/infrastructure/http/controllers"
import { OnboardingController } from "@/Customers/infrastructure/http/controllers/Onboarding.controller"
import { NotificationController } from "@/Shared/infrastructure/controllers/Notification.controller"
import { MemberController } from "@/Church/infrastructure/http/controllers/Member.controller"
import { accountsReceivableControllers } from "@/AccountsReceivable/infrastructure/http/controllers"
import { AccountPayableController } from "@/AccountsPayable/infrastructure/http/controllers/AccountPayable.controller"

export const routerModule = () =>
  new RoutesModule([
    { path: "/api/v1/church", router: churchRouters },
    { path: "/api/v1/minister", router: ministerRoute },
    { path: "/api/v1/finance", router: financialRouter },
    { path: "/api/v1/bank", router: bankingRoutes },
    { path: "/api/v1/account-payable", router: groupAccountsPayableRoutes },
    { path: "/api/v1/world", router: worldRoute },
    { path: "/api/v1/reports", router: reportsRouter },
    { path: "/api/v1/purchase", router: purchaseRouter },
    { path: "/api/v1/patrimony", router: patrimonyRouter },
    { path: "/api/v1/rbac", router: rbacRouter },
  ])

export const controllersModule = () =>
  new ControllersModule([
    ...accountsReceivableControllers(),
    ...financialControllers(),
    ...consolidatedFinancialControllers(),
    ...financeConfigControllers(),
    ...scheduleControllers(),

    AccountPayableController,
    MemberController,
    UserController,
    OnboardingController,
    NotificationController,
  ])
