import { Validator } from "node-input-validator"
import { HttpStatus } from "@/Shared/domain"

export const ListBankStatementsValidator = async (req, res, next) => {
  const rules = {
    bank: "string",
    status: "string|in:PENDING,UNMATCHED,RECONCILED",
    month: "integer|between:1,12",
    year: "integer|min:2000",
    churchId: "string",
    dateFrom: "date",
    dateTo: "date",
  }

  const validator = new Validator(req.query, rules)

  const matched = await validator.check()

  if (!matched) {
    return res.status(HttpStatus.UNPROCESSABLE_ENTITY).send(validator.errors)
  }

  next()
}

