import { ChurchController } from "./Church.controller"
import { DevotionalCommunityController } from "./DevotionalCommunity.controller"
import { DevotionalController } from "./Devotional.controller"
import { IntegrationsController } from "./Integrations.controller"
import { MemberController } from "./Member.controller"
import { MinisterController } from "./Minister.controller"
import { PublicMemberRegistrationController } from "./PublicMemberRegistration.controller"

export const churchControllers = () => [
  ChurchController,
  IntegrationsController,
  MinisterController,
  MemberController,
  DevotionalController,
  DevotionalCommunityController,
  PublicMemberRegistrationController,
]
