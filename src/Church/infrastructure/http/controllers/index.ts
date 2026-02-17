import { ChurchController } from "./Church.controller"
import { IntegrationsController } from "./Integrations.controller"
import { MemberController } from "./Member.controller"
import { MinisterController } from "./Minister.controller"

export const churchControllers = () => [
  ChurchController,
  IntegrationsController,
  MinisterController,
  MemberController,
]
