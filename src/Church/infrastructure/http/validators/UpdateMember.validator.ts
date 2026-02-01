import { Logger } from "@/Shared/adapter"
import { HttpStatus } from "@/Shared/domain"
import { Validator } from "node-input-validator"
import type { NextFunction, ServerResponse } from "bun-platform-kit"

const logger = Logger("UpdateMemberValidator")

export const UpdateMemberValidator = async (
  req: Request,
  res: ServerResponse,
  next: NextFunction
): Promise<void> => {
  const body = req.body as any

  const payload = { ...req.body, memberId: body.params.memberId }

  logger.info("Validating update member payload", payload)

  const rules = {
    memberId: "required",
    name: "sometimes|maxLength:150",
    email: "sometimes|email",
    phone: "sometimes",
    dni: "sometimes",
    conversionDate: "sometimes|dateFormat:YYYY-MM-DD",
    baptismDate: "sometimes|dateFormat:YYYY-MM-DD",
    birthdate: "sometimes|dateFormat:YYYY-MM-DD",
    isTreasurer: "sometimes|boolean",
    active: "sometimes|boolean",
  }

  const v = new Validator(payload, rules)
  const matched = await v.check()

  if (!matched) {
    res.status(HttpStatus.UNPROCESSABLE_ENTITY).send(v.errors)
    return
  }

  next()
}
