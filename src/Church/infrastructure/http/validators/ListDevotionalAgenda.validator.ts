import { HttpStatus } from "@/Shared/domain"
import { Logger } from "@/Shared/adapter"
import { Validator } from "node-input-validator"
import type { NextFunction, ServerResponse } from "bun-platform-kit"

const logger = Logger("ListDevotionalAgendaValidator")

export default async (
  req: Request,
  res: ServerResponse,
  next: NextFunction
): Promise<void> => {
  const payload = req.query as any

  logger.info("Validating devotional agenda query", payload)

  const rules = {
    weekStartDate: "required|dateFormat:YYYY-MM-DD",
    status:
      "sometimes|string|in:pending,generating,in_review,approved,sending,sent,failed",
    audience: "sometimes|string|in:all,youth,women,men,kids",
    channel: "sometimes|string|in:push,whatsapp",
  }

  const v = new Validator(payload, rules)
  const matched = await v.check()

  if (!matched) {
    res.status(HttpStatus.UNPROCESSABLE_ENTITY).send(v.errors)
    return
  }

  next()
}
