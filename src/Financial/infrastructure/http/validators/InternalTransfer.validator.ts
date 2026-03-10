import { Validator } from "node-input-validator"
import { HttpStatus } from "@/Shared/domain"
import { Logger } from "@/Shared/adapter"

export default async (req, res, next) => {
  const payload = req.body
  const logger = Logger("InternalTransferValidator")

  logger.info(`Validating internal transfer payload`, payload)

  const rules = {
    fromAvailabilityAccountId: "required|string",
    toAvailabilityAccountId: "required|string",
    amount: "required|numeric|min:0.01",
    date: "required|dateFormat:YYYY-MM-DD",
    description: "string",
  }

  const validator = new Validator(payload, rules)
  const matched = await validator.check()

  if (!matched) {
    return res.status(HttpStatus.UNPROCESSABLE_ENTITY).send(validator.errors)
  }

  if (
    payload.fromAvailabilityAccountId &&
    payload.fromAvailabilityAccountId === payload.toAvailabilityAccountId
  ) {
    return res.status(HttpStatus.UNPROCESSABLE_ENTITY).send({
      toAvailabilityAccountId: {
        message: "Destination account must be different from source account",
        rule: "different",
      },
    })
  }

  next()
}
