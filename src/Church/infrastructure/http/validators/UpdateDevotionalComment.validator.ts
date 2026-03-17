import { HttpStatus } from "@/Shared/domain"
import { Logger } from "@/Shared/adapter"
import { Validator } from "node-input-validator"
import type { NextFunction, ServerResponse } from "bun-platform-kit"

const logger = Logger("UpdateDevotionalCommentValidator")

export default async (
  req: Request,
  res: ServerResponse,
  next: NextFunction
): Promise<void> => {
  const payload = req.body as any

  logger.info("Validating devotional comment update payload", payload)

  const rules = {
    message: "required|string|minLength:2|maxLength:500",
  }

  const v = new Validator(payload, rules)
  const matched = await v.check()

  if (!matched) {
    res.status(HttpStatus.UNPROCESSABLE_ENTITY).send(v.errors)
    return
  }

  next()
}
