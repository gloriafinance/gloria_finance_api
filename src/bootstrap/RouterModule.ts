import { ControllersModule } from "bun-platform-kit"

import { financialControllers } from "@/Financial/infrastructure/http/controllers"
import { consolidatedFinancialControllers } from "@/ConsolidatedFinancial/infrastructure/http/controllers"
import { UserController } from "@/SecuritySystem/infrastructure/http/controllers/User.controller"
import { RbacController } from "@/SecuritySystem/infrastructure/http/controllers/rbac/Rbac.controller"
import { financeConfigControllers } from "@/FinanceConfig/infrastructure/controllers"
import { scheduleControllers } from "@/Schedule/infrastructure/http/controllers"
import { OnboardingController } from "@/Customers/infrastructure/http/controllers/Onboarding.controller"
import { NotificationController } from "@/Shared/infrastructure/controllers/Notification.controller"
import { accountsReceivableControllers } from "@/AccountsReceivable/infrastructure/http/controllers"
import { AccountPayableController } from "@/AccountsPayable/infrastructure/http/controllers/AccountPayable.controller"
import { bankControllers } from "@/Banking/infrastructure/http/controllers"
import { FinanceReportsController } from "@/Reports/infrastructure/http/controllers/FinanceReports.controller"
import { PurchaseController } from "@/Purchases/infrastructure/http/controllers/Purchase.controller"
import { PatrimonyController } from "@/Patrimony/infrastructure/http/controllers/Patrimony.controller"
import { churchControllers } from "@/Church/infrastructure/http/controllers"
import { WorldController } from "@/World/infrastructure/http/controllers/World.controller"
import { DevotionalController } from "@/Church/infrastructure/http/controllers/Devotional.controller.ts"

export const controllersModule = () =>
  new ControllersModule([
    ...accountsReceivableControllers(),
    ...financialControllers(),
    ...consolidatedFinancialControllers(),
    ...financeConfigControllers(),
    ...scheduleControllers(),
    ...bankControllers(),

    ...churchControllers(),
    AccountPayableController,
    UserController,
    RbacController,
    OnboardingController,
    NotificationController,
    FinanceReportsController,
    PurchaseController,
    PatrimonyController,
    WorldController,
    DevotionalController,
  ])
