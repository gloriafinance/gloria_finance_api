import { Logger } from "@/Shared/adapter"
import { HttpStatus } from "@/Shared/domain"
import { NextFunction, Request, Response } from "express"
import { Validator } from "node-input-validator"

const logger = Logger("CreateScheduleItemValidator")

const dayOfWeekValues =
  "SUNDAY,MONDAY,TUESDAY,WEDNESDAY,THURSDAY,FRIDAY,SATURDAY"
const scheduleItemTypes = "SERVICE,CELL,MINISTRY_MEETING,REGULAR_EVENT,OTHER"
const visibilityValues = "PUBLIC,INTERNAL_LEADERS"

export default async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const payload = req.body

  logger.info("Validating create schedule item payload", payload)

  const rules = {
    type: `required|string|in:${scheduleItemTypes}`,
    title: "required|string",
    description: "string",
    "location.name": "required|string",
    "location.address": "string",
    "recurrencePattern.type": "required|string|in:WEEKLY",
    "recurrencePattern.dayOfWeek": `required|string|in:${dayOfWeekValues}`,
    "recurrencePattern.time": [
      "required",
      ["regex", "^([01]\\d|2[0-3]):[0-5]\\d$"],
    ],
    "recurrencePattern.durationMinutes": "required|integer|min:1",
    "recurrencePattern.timezone": "required|string",
    "recurrencePattern.startDate": "required|dateFormat:YYYY-MM-DD",
    "recurrencePattern.endDate": "dateFormat:YYYY-MM-DD",
    visibility: `required|string|in:${visibilityValues}`,
    director: "required|string",
    preacher: "required|string",
    observations: "string",
  }

  const v = new Validator(payload, rules)
  const matched = await v.check()

  if (!matched) {
    res.status(HttpStatus.UNPROCESSABLE_ENTITY).send(v.errors)
    return
  }

  next()
}
