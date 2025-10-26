import { Logger } from "@/Shared/adapter"
import { HttpStatus } from "@/Shared/domain"
import { AssetInventoryStatus } from "@/Patrimony"
import { Validator } from "node-input-validator"

const logger = Logger("RecordAssetInventoryValidator")

export default async (req, res, next) => {
  const payload = {
    ...req.body,
    assetId: req.params.assetId,
  }

  logger.info("Validating physical inventory payload", payload)

  const statusValues = Object.values(AssetInventoryStatus).join(",")

  const rules = {
    assetId: "required|string",
    status: `required|string|in:${statusValues}`,
    checkedAt: "dateFormat:YYYY-MM-DD",
    notes: "string",
  }

  const validator = new Validator(payload, rules)

  const matched = await validator.check()

  if (!matched) {
    return res.status(HttpStatus.UNPROCESSABLE_ENTITY).send(validator.errors)
  }

  req.body = payload

  next()
}
