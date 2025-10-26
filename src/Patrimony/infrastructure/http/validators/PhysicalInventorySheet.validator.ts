import { Logger } from "@/Shared/adapter"
import { HttpStatus } from "@/Shared/domain"
import { AssetStatus } from "@/Patrimony"
import { Validator } from "node-input-validator"

const logger = Logger("PhysicalInventorySheetValidator")

export default async (req, res, next) => {
  const payload = req.query

  logger.info("Validating physical inventory sheet query", payload)

  const statusValues = Object.values(AssetStatus).join(",")

  const rules = {
    category: "string",
    status: `in:${statusValues}`,
  }

  const validator = new Validator(payload, rules)

  const matched = await validator.check()

  if (!matched) {
    return res.status(HttpStatus.UNPROCESSABLE_ENTITY).send(validator.errors)
  }

  next()
}
