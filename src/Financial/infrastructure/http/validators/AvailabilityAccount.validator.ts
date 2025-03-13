import { HttpStatus } from "../../../../Shared/domain"
import { Validator } from "node-input-validator"
import { Logger } from "../../../../Shared/adapter"

export default async (req, res, next) => {
  const payload = req.body
  const logger = Logger("AvailabilityAccountValidator")

  logger.info(`Validando  ${JSON.stringify(payload)}`)

  const rule = {
    accountType: "required|in:BANK,CASH,WALLET,INVESTMENT",
    active: "required|boolean",
    churchId: "required",
    accountName: "required|string",
    symbol: "required|string",
  }

  const v = new Validator(payload, rule)

  const matched = await v.check()

  if (!matched) {
    return res.status(HttpStatus.UNPROCESSABLE_ENTITY).send(v.errors)
  }

  next()
}
