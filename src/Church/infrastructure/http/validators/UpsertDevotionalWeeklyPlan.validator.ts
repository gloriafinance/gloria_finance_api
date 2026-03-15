import { HttpStatus } from "@/Shared/domain"
import { Logger } from "@/Shared/adapter"
import { Validator } from "node-input-validator"
import type { NextFunction, ServerResponse } from "bun-platform-kit"

const logger = Logger("UpsertDevotionalWeeklyPlanValidator")

export default async (
  req: Request,
  res: ServerResponse,
  next: NextFunction
): Promise<void> => {
  const payload = req.body as any

  logger.info("Validating devotional weekly plan payload", payload)

  const rules = {
    isEnabled: "required|boolean",
    themeWeek: "sometimes|string|maxLength:140",
    daysOfWeek: "array",
    sendTime: ["sometimes", ["regex", "^([01]\\d|2[0-3]):[0-5]\\d$"]],
    audience: "sometimes|string|in:all,youth,women,men,kids",
    requiresPastorReview: "required|boolean",
    "channels.pushEnabled": "sometimes|boolean",
    "channels.whatsappEnabled": "sometimes|boolean",
    dayConfigs: "array",
  }

  const v = new Validator(payload, rules)
  const matched = await v.check()

  if (!matched) {
    res.status(HttpStatus.UNPROCESSABLE_ENTITY).send(v.errors)
    return
  }

  next()
}
