import type {
  NextFunction,
  ServerRequest,
  ServerResponse,
} from "bun-platform-kit"
import { Validator } from "node-input-validator"
import { HttpStatus } from "@/Shared/domain"

const normalizeArrayField = (
  payload: Record<string, any>,
  fieldName: string
): any[] => {
  return Object.keys(payload)
    .filter((key) => key.startsWith(`${fieldName}[`))
    .reduce((acc, key) => {
      const match = key.match(
        new RegExp(`^${fieldName}\\[(\\d+)\\]\\[(\\w+)\\]$`)
      )

      if (match) {
        const [_, index, field] = match
        acc[index] = acc[index] || {}
        acc[index][field] = payload[key]
      }

      return acc
    }, [] as any[])
}

const normalizeObjectField = (
  payload: Record<string, any>,
  fieldName: string
): Record<string, any> | undefined => {
  const keys = Object.keys(payload).filter((key) =>
    key.startsWith(`${fieldName}[`)
  )

  if (!keys.length) {
    return undefined
  }

  return keys.reduce(
    (acc, key) => {
      const match = key.match(new RegExp(`^${fieldName}\\[(\\w+)\\]$`))

      if (match) {
        const [_, field] = match
        acc[field] = payload[key]
      }

      return acc
    },
    {} as Record<string, any>
  )
}

export default async (
  req: ServerRequest,
  res: ServerResponse,
  next: NextFunction
) => {
  const payload = req.body as any

  if (!Array.isArray(payload.items)) {
    const normalizedItems = normalizeArrayField(payload, "items")
    if (normalizedItems.length) {
      payload.items = normalizedItems
    }
  }

  if (!Array.isArray(payload.installments)) {
    const normalizedInstallments = normalizeArrayField(payload, "installments")
    if (normalizedInstallments.length) {
      payload.installments = normalizedInstallments
    }
  }

  if (!Array.isArray(payload.taxes)) {
    const normalizedTaxes = normalizeArrayField(payload, "taxes")
    if (normalizedTaxes.length) {
      payload.taxes = normalizedTaxes
    }
  }

  if (!payload.taxDocument || Array.isArray(payload.taxDocument)) {
    const normalizedTaxDocument = normalizeObjectField(payload, "taxDocument")
    if (normalizedTaxDocument) {
      payload.taxDocument = normalizedTaxDocument
    }
  }

  if (!payload.taxMetadata || Array.isArray(payload.taxMetadata)) {
    const normalizedTaxMetadata = normalizeObjectField(payload, "taxMetadata")
    if (normalizedTaxMetadata) {
      payload.taxMetadata = normalizedTaxMetadata
    }
  }

  if (typeof payload.taxMetadata?.taxExempt === "string") {
    payload.taxMetadata.taxExempt = payload.taxMetadata.taxExempt === "true"
  }

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

  req.body["items"] = payload.items
  req.body["installments"] = payload.installments
  req.body["taxes"] = payload.taxes
  req.body["taxDocument"] = payload.taxDocument
  req.body["taxMetadata"] = payload.taxMetadata

  next()
}
