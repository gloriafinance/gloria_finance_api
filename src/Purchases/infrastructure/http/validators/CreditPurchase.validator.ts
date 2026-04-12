import type {
  NextFunction,
  ServerRequest,
  ServerResponse,
} from "bun-platform-kit"
import { Validator } from "node-input-validator"
import { HttpStatus } from "@/Shared/domain"

export default async (
  req: ServerRequest,
  res: ServerResponse,
  next: NextFunction
) => {
  const payload = req.body as any

  if (payload.taxes === null) {
    payload.taxes = []
  }

  if (payload.taxMetadata === null) {
    payload.taxMetadata = undefined
  }

  if (payload.installments === null) {
    payload.installments = []
  }

  const rule: Record<string, string> = {
    purchaseDate: "required|dateFormat:YYYY-MM-DD",
    total: "required|numeric",
    tax: "required|numeric",
    description: "required|string",
    items: "required|array",
    "items.*.quantity": "required|numeric",
    "items.*.price": "required|numeric",
    "items.*.name": "required|string",

    supplierId: "required|string",
    amountTotal: "sometimes|numeric",
    installments: "sometimes|array",
    taxDocument: "required|object",
    "taxDocument.type": "required|string|in:INVOICE,RECEIPT,CONTRACT,OTHER",
    "taxDocument.number": "sometimes|string",
    "taxDocument.date": "required|date",
  }

  const hasInstallmentsArray = Array.isArray(payload.installments)

  if (hasInstallmentsArray) {
    Object.assign(rule, {
      "installments.*.amount": "required|numeric",
      "installments.*.dueDate": "required|date",
    })
  }

  if (Array.isArray(payload.taxes)) {
    Object.assign(rule, {
      taxes: "array",
      "taxes.*.taxType": "required|string",
      "taxes.*.percentage": "required|numeric",
      "taxes.*.amount": "numeric",
      "taxes.*.status": "string|in:TAXED,EXEMPT,SUBSTITUTION,NOT_APPLICABLE",
    })
  } else {
    rule.taxes = "sometimes|array"
  }

  if (payload.taxMetadata) {
    Object.assign(rule, {
      taxMetadata: "object",
      "taxMetadata.status":
        "string|in:TAXED,EXEMPT,SUBSTITUTION,NOT_APPLICABLE",
      "taxMetadata.taxExempt": "boolean",
      "taxMetadata.exemptionReason": "string",
      "taxMetadata.cstCode": "string",
      "taxMetadata.cfop": "string",
      "taxMetadata.observation": "string",
    })
  } else {
    rule.taxMetadata = "sometimes|object"
  }

  const v = new Validator(payload, rule)

  const matched = await v.check()

  if (!matched) {
    return res.status(HttpStatus.UNPROCESSABLE_ENTITY).send(v.errors)
  }

  next()
}
