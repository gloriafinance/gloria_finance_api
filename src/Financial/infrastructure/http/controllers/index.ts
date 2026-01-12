import { ContributionMemberController } from "./ContributionMember.controller"
import { ContribuitionController } from "./OnlineContribution.controller"

export const financialControllers = () => [
  ContributionMemberController,
  ContribuitionController,
]
