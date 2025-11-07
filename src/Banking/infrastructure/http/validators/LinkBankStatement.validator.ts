import { Validator } from "node-input-validator"
import { HttpStatus } from "@/Shared/domain"

export const LinkBankStatementValidator = async (req, res, next) => {
  const validator = new Validator(req.body, {
    financialRecordId: "required|string",
  })

  const matched = await validator.check()

  if (!matched) {
    return res.status(HttpStatus.UNPROCESSABLE_ENTITY).send(validator.errors)
  }

  next()
}
