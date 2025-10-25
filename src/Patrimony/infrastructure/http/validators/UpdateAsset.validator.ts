import { Logger } from "@/Shared/adapter"
import { HttpStatus } from "@/Shared/domain"
import { AssetStatus } from "../../../domain"
import { Validator } from "node-input-validator"
import {
  hasMissingAttachmentSource,
  normalizeAttachmentPayload,
} from "./utils/attachmentPayload"

const logger = Logger("UpdateAssetValidator")

export default async (req, res, next) => {
  const { attachments, provided } = normalizeAttachmentPayload(
    req.body.attachments,
    req.files?.attachments
  )

  const payload = { ...req.body }

  if (provided) {
    payload.attachments = attachments
  } else {
    delete payload.attachments
  }

  if (Array.isArray(payload.attachmentsToRemove)) {
    payload.attachmentsToRemove = payload.attachmentsToRemove
      .map((value) => (typeof value === "string" ? value.trim() : ""))
      .filter((value) => value.length > 0)
  } else {
    delete payload.attachmentsToRemove
  }

  req.body = payload

  logger.info("Validating update asset payload", payload)

  const statusValues = Object.values(AssetStatus).join(",")

  const rules = {
    assetId: "required|string",
    name: "string",
    category: "string",
    value: "numeric",
    acquisitionDate: "dateFormat:YYYY-MM-DD",
    location: "string",
    responsibleId: "string",
    status: `in:${statusValues}`,
    attachments: "array",
    "attachments.*.name": "required|string",
    "attachments.*.mimetype": "required|string",
    "attachments.*.size": "required|integer",
    attachmentsToRemove: "array",
    "attachmentsToRemove.*": "string",
  }

  const validator = new Validator(payload, rules)

  const matched = await validator.check()

  if (!matched) {
    return res.status(HttpStatus.UNPROCESSABLE_ENTITY).send(validator.errors)
  }

  if (Array.isArray(payload.attachments) && payload.attachments.length > 3) {
    return res.status(HttpStatus.UNPROCESSABLE_ENTITY).send({
      attachments: {
        message: "Limite máximo de 3 anexos por bem patrimonial.",
        rule: "max",
      },
    })
  }

  if (
    Array.isArray(payload.attachments) &&
    payload.attachments.length > 0 &&
    hasMissingAttachmentSource(payload.attachments)
  ) {
    return res.status(HttpStatus.UNPROCESSABLE_ENTITY).send({
      attachments: {
        message:
          "Cada anexo deve incluir um arquivo para upload ou uma URL existente.",
        rule: "required",
      },
    })
  }

  next()
}
