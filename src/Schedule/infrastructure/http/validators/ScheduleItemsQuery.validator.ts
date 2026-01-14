import { Logger } from "@/Shared/adapter"
import { HttpStatus } from "@/Shared/domain"
import { Validator } from "node-input-validator"

const logger = Logger("ScheduleItemsQueryValidator")

const scheduleItemTypes = "SERVICE,CELL,MINISTRY_MEETING,REGULAR_EVENT,OTHER"
const visibilityValues = "PUBLIC,INTERNAL_LEADERS"

export default async (
  req: Request,
  res: ServerResponse,
  next: NextFunction
): Promise<void> => {
  const payload = req.query

  logger.info("Validating schedule items query", payload)

  const rules = {
    type: `sometimes|string|in:${scheduleItemTypes}`,
    visibility: `sometimes|string|in:${visibilityValues}`,
    isActive: "sometimes|boolean",
  }

  const v = new Validator(payload, rules)
  const matched = await v.check()

  if (!matched) {
    res.status(HttpStatus.UNPROCESSABLE_ENTITY).send(v.errors)
    return
  }

  next()
}
