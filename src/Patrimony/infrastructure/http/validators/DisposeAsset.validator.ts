import { Logger } from "@/Shared/adapter"
import { HttpStatus } from "@/Shared/domain"
import { AssetStatus } from "@/Patrimony"
import { Validator } from "node-input-validator"

const logger = Logger("DisposeAssetValidator")

const allowedStatuses = [
  AssetStatus.DONATED,
  AssetStatus.SOLD,
  AssetStatus.LOST,
]

export default async (req, res, next) => {
  const payload = {
    ...req.body,
    assetId: req.params.assetId,
  }

  logger.info("Validating asset disposal payload", payload)

  const statusValues = allowedStatuses.join(",")

  const rules = {
    assetId: "required|string",
    status: `required|string|in:${statusValues}`,
    reason: "required|string",
    disposedAt: "dateFormat:YYYY-MM-DD",
    observations: "string",
  }

  const validator = new Validator(payload, rules)

  const matched = await validator.check()

  if (!matched) {
    return res.status(HttpStatus.UNPROCESSABLE_ENTITY).send(validator.errors)
  }

  req.body = payload

  next()
}
