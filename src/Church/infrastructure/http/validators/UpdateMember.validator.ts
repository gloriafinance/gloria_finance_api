import { Logger } from "@/Shared/adapter"
import { HttpStatus } from "@/Shared/domain"
import { NextFunction, Request, Response } from "express"
import { Validator } from "node-input-validator"

const logger = Logger("UpdateMemberValidator")

export const UpdateMemberValidator = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const payload = { ...req.body, memberId: req.params.memberId }

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
