import { Logger } from "@/Shared/adapter"
import { HttpStatus } from "@/Shared/domain"
import { AssetStatus } from "../../../domain"
import { Validator } from "node-input-validator"

const logger = Logger("ListAssetsValidator")

export default async (req, res, next) => {
  const payload = req.query

  logger.info("Validating list assets query", payload)

  const statusValues = Object.values(AssetStatus).join(",")

  const rules = {
    category: "string",
    status: `in:${statusValues}`,
    search: "string",
    page: "integer",
    perPage: "integer",
  }

  const validator = new Validator(payload, rules)

  const matched = await validator.check()

  if (!matched) {
    return res.status(HttpStatus.UNPROCESSABLE_ENTITY).send(validator.errors)
  }

  next()
}
