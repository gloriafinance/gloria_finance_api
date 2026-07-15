import { HttpStatus } from "@/Shared/domain"
import { Validator } from "node-input-validator"
import { Logger } from "@/Shared/adapter"

export default async (req, res, next) => {
  const payload = req.body
  const logger = Logger("AvailabilityAccountUpdateValidator")

  logger.info(`Validating ${JSON.stringify(payload)}`)

  const rule = {
    accountName: "required|string",
    active: "required|boolean",
  }

  const v = new Validator(payload, rule)

  const matched = await v.check()

  if (!matched) {
    return res.status(HttpStatus.UNPROCESSABLE_ENTITY).send(v.errors)
  }

  next()
}
