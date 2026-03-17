import { HttpStatus } from "@/Shared/domain"
import { Logger } from "@/Shared/adapter"
import { Validator } from "node-input-validator"
import type { NextFunction, ServerResponse } from "bun-platform-kit"

const logger = Logger("SetDevotionalReactionValidator")

export default async (
  req: Request,
  res: ServerResponse,
  next: NextFunction
): Promise<void> => {
  const payload = req.body as any

  logger.info("Validating devotional reaction payload", payload)

  const rules = {
    reactionType: "required|string|in:edified,amen,challenged,peace,reflect",
  }

  const v = new Validator(payload, rules)
  const matched = await v.check()

  if (!matched) {
    res.status(HttpStatus.UNPROCESSABLE_ENTITY).send(v.errors)
    return
  }

  next()
}
