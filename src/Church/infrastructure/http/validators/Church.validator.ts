import { HttpStatus } from "../../../../Shared/domain"
import { Validator } from "node-input-validator"
import { Logger } from "../../../../Shared/adapter"

export default async (req, res, next) => {
  const payload = req.body
  const logger = Logger("ChurchValidator")

  logger.info(`Validando iglesia ${JSON.stringify(payload)}`)

  const rule = {
    name: "required|maxLength:150",
    city: "required",
    address: "required|maxLength:80",
    street: "required|maxLength:40",
    number: "required",
    postalCode: "required|minLength:7|maxLength:10",
    email: "required|email",
    openingDate: "required|dateFormat:YYYY-MM-DD",
    regionId: "required",
    timezone: "string|maxLength:80",
  }

  const v = new Validator(payload, rule)

  const matched = await v.check()

  if (!matched) {
    return res.status(HttpStatus.UNPROCESSABLE_ENTITY).send(v.errors)
  }

  next()
}
