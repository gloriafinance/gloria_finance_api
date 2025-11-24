import { Validator } from "node-input-validator"
import { Logger } from "@/Shared/adapter"
import { HttpStatus } from "@/Shared/domain"

export default async (req, res, next) => {
  const payload = req.body
  const logger = Logger("RebuildMasterData")

  logger.info(`Validando banco ${JSON.stringify(payload)}`)

  const rule = {
    churchId: "required|string",
    year: "required|integer|maxLength:4",
    month: "required|integer|maxLength:2",
  }

  const v = new Validator(payload, rule)

  const matched = await v.check()

  if (!matched) {
    return res.status(HttpStatus.UNPROCESSABLE_ENTITY).send(v.errors)
  }

  next()
}
