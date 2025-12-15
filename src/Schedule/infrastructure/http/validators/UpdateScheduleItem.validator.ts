import { Logger } from "@/Shared/adapter"
import { HttpStatus } from "@/Shared/domain"
import { NextFunction, Request, Response } from "express"
import { Validator } from "node-input-validator"

const logger = Logger("UpdateScheduleItemValidator")

const dayOfWeekValues =
  "SUNDAY,MONDAY,TUESDAY,WEDNESDAY,THURSDAY,FRIDAY,SATURDAY"
const visibilityValues = "PUBLIC,INTERNAL_LEADERS"

export default async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const payload = req.body

  logger.info("Validating update schedule item payload", payload)

  const rules = {
    title: "sometimes|string",
    description: "sometimes|string",
    "location.name": "sometimes|string",
    "location.address": "sometimes|string",
    "recurrencePattern.type": "sometimes|string|in:WEEKLY",
    "recurrencePattern.dayOfWeek": `sometimes|string|in:${dayOfWeekValues}`,
    "recurrencePattern.time": "sometimes|regex:/^([01]\\d|2[0-3]):[0-5]\\d$/",
    "recurrencePattern.durationMinutes": "sometimes|integer|min:1",
    "recurrencePattern.timezone": "sometimes|string",
    "recurrencePattern.startDate": "sometimes|dateFormat:YYYY-MM-DD",
    "recurrencePattern.endDate": "sometimes|dateFormat:YYYY-MM-DD",
    visibility: `sometimes|string|in:${visibilityValues}`,
    director: "sometimes|string",
    preacher: "sometimes|string",
    observations: "sometimes|string",
  }

  const v = new Validator(payload, rules)
  const matched = await v.check()

  if (!matched) {
    res.status(HttpStatus.UNPROCESSABLE_ENTITY).send(v.errors)
    return
  }

  next()
}
