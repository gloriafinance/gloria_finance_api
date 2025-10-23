import { NextFunction, Request, Response } from "express"
import { Validator } from "node-input-validator"
import { HttpStatus } from "@/Shared/domain"
import { Logger } from "@/Shared/adapter"

export default async (req: Request, res: Response, next: NextFunction) => {
  const payload = { ...req.body }
  const logger = Logger("CreateAccountPayableValidator")

  logger.info(`Validating`, payload)

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
    supplierId: "required|string",
    description: "required|string",
    amountTotal: "sometimes|numeric",
    installments: "sometimes|array",
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

  const hasInstallments =
    Array.isArray(payload.installments) && payload.installments.length > 0

  if (!hasInstallments && payload.amountTotal === undefined) {
    return res.status(HttpStatus.UNPROCESSABLE_ENTITY).send({
      amountTotal: {
        message:
          "Informe o valor total da nota fiscal quando optar por cadastrar cada NF individualmente (cenário B).",
        rule: "required_when_no_installments",
      },
    })
  }

  const hasTaxes = Array.isArray(payload.taxes) && payload.taxes.length > 0
  const taxExemptFlag = payload.taxMetadata?.taxExempt

  if (taxExemptFlag === true && hasTaxes) {
    return res.status(HttpStatus.UNPROCESSABLE_ENTITY).send({
      taxes: {
        message:
          "Remova as linhas de imposto quando taxMetadata.taxExempt for true (conta isenta).",
        rule: "forbidden_when_exempt",
      },
    })
  }

  if (taxExemptFlag === false && !hasTaxes) {
    return res.status(HttpStatus.UNPROCESSABLE_ENTITY).send({
      taxes: {
        message:
          "Forneça ao menos uma linha de imposto quando a conta não estiver marcada como isenta (taxMetadata.taxExempt = false).",
        rule: "required_when_taxable",
      },
    })
  }

  req.body.taxes = payload.taxes
  req.body.taxMetadata = payload.taxMetadata

  next()
}
