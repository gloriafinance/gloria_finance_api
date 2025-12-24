import { AccountReceivableForMemberController } from "./AccountReceivableForMember.controller"
import { AccountReceivableController } from "./AccountReceivable.controller"

export const accountsReceivableControllers = () => [
  AccountReceivableController,
  AccountReceivableForMemberController,
]
