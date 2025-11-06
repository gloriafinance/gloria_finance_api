import { Validator } from "node-input-validator"
import { HttpStatus } from "@/Shared/domain"

export const ImportBankStatementValidator = async (req, res, next) => {
  const payload = req.body ?? {}
  const rules = {
    bankId: "required|string",
    month: "required|integer|between:1,12",
    year: "required|integer|min:2000",
    accountName: "string",
    churchId: "string",
  }

  const validator = new Validator(payload, rules)
  const matched = await validator.check()

  if (!matched) {
    return res.status(HttpStatus.UNPROCESSABLE_ENTITY).send(validator.errors)
  }

  next()
}
