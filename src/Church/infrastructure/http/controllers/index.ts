import { ChurchController } from "./Church.controller"
import { MemberController } from "./Member.controller"
import { MinisterController } from "./Minister.controller"

export const churchControllers = () => [
  ChurchController,
  MinisterController,
  MemberController,
]
