import { HttpStatus } from "@/Shared/domain"
import { Logger } from "@/Shared/adapter"
import { Validator } from "node-input-validator"
import type { NextFunction, ServerResponse } from "bun-platform-kit"

const logger = Logger("UpdateDevotionalContentValidator")

export default async (
  req: Request,
  res: ServerResponse,
  next: NextFunction
): Promise<void> => {
  const payload = req.body as any

  logger.info("Validating devotional update payload", payload)

  const rules = {
    title: "required|string|maxLength:120",
    devotional: "required|string|maxLength:5000",
    scriptures: "required|array|minLength:1|maxLength:5",
    pushTitle: "required|string|maxLength:80",
    pushBody: "required|string|maxLength:160",
  }

  const v = new Validator(payload, rules)
  const matched = await v.check()

  if (!matched) {
    res.status(HttpStatus.UNPROCESSABLE_ENTITY).send(v.errors)
    return
  }

  next()
}
