import { HttpStatus } from "@/Shared/domain"
import { Logger } from "@/Shared/adapter"
import { Validator } from "node-input-validator"
import type { NextFunction, ServerResponse } from "bun-platform-kit"

const logger = Logger("ListDevotionalHistoryValidator")

export default async (
  req: Request,
  res: ServerResponse,
  next: NextFunction
): Promise<void> => {
  const payload = req.query as any

  logger.info("Validating devotional history query", payload)

  const rules = {
    fromDate: "sometimes|dateFormat:YYYY-MM-DD",
    toDate: "sometimes|dateFormat:YYYY-MM-DD",
    audience: "sometimes|string|in:all,youth,women,men,kids",
    channel: "sometimes|string|in:push,whatsapp",
    overall: "sometimes|string|in:sent,partial,error",
    query: "sometimes|string|maxLength:120",
  }

  const v = new Validator(payload, rules)
  const matched = await v.check()

  if (!matched) {
    res.status(HttpStatus.UNPROCESSABLE_ENTITY).send(v.errors)
    return
  }

  next()
}
