import { Validator } from "node-input-validator"
import { HttpStatus } from "../../../../Shared/domain"
import { Logger } from "../../../../Shared/adapter"

export default async (req, res, next) => {
  const payload = req.body
  const logger = Logger("ContributionValidator")

  logger.info(`Validando contribucion`, payload)

  const rule = {
    memberId: "required|string",
    amount: "required|numeric",
    availabilityAccountId: "required|string",
    financialConceptId: "required|string",
  }

  const customMessage = {
    "type.in": "Invalid value, accepted values are: OFFERING, TITHE.",
  }

  const v = new Validator(payload, rule, customMessage)

  const matched = await v.check()

  if (!matched) {
    return res.status(HttpStatus.UNPROCESSABLE_ENTITY).send(v.errors)
  }

  next()
}
