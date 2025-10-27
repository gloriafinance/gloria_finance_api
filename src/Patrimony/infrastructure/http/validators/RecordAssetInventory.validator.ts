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

  if (typeof payload.code === "string") {
    payload.code = payload.code.trim()

    if (payload.code.length === 0) {
      delete payload.code
    }
  }

  if (typeof payload.quantity === "string") {
    const trimmed = payload.quantity.trim()

    if (trimmed.length === 0) {
      delete payload.quantity
    } else {
      payload.quantity = trimmed
    }
  }

  logger.info("Validating physical inventory payload", payload)

  const statusValues = Object.values(AssetInventoryStatus).join(",")

  const rules = {
    assetId: "required|string",
    status: `required|string|in:${statusValues}`,
    checkedAt: "dateFormat:YYYY-MM-DD",
    notes: "string",
    code: "required|string",
    quantity: "required|integer|min:1",
  }

  const validator = new Validator(payload, rules)

  const matched = await validator.check()

  if (!matched) {
    return res.status(HttpStatus.UNPROCESSABLE_ENTITY).send(validator.errors)
  }

  req.body = payload

  next()
}
