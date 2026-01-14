import { Logger } from "@/Shared/adapter"
import { HttpStatus } from "@/Shared/domain"
import { Validator } from "node-input-validator"

const logger = Logger("WeeklyScheduleQueryValidator")

const visibilityValues = "PUBLIC,INTERNAL_LEADERS"

export default async (
  req: Request,
  res: ServerResponse,
  next: NextFunction
): Promise<void> => {
  const payload = req.query

  logger.info("Validating weekly schedule query", payload)

  const rules = {
    weekStartDate: "required|dateFormat:YYYY-MM-DD",
    visibilityScope: `sometimes|string|in:${visibilityValues}`,
  }

  const v = new Validator(payload, rules)
  const matched = await v.check()

  if (!matched) {
    res.status(HttpStatus.UNPROCESSABLE_ENTITY).send(v.errors)
    return
  }

  next()
}
