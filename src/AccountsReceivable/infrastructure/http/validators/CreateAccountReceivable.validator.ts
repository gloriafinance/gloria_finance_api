import { Logger } from "@/Shared/adapter"
import { Validator } from "node-input-validator"
import { HttpStatus } from "@/Shared/domain"
import { NextFunction, Request, Response } from "express"

export default async (req: Request, res: Response, next: NextFunction) => {
  const payload = req.body
  const logger = Logger("CreateAccountReceivableValidator")

  logger.info(`Validating  ${JSON.stringify(payload)}`)

  const rule = {
    debtor: "required|object",
    "debtor.debtorType": "required|string|in:MEMBER,GROUP,EXTERNAL",
    type: "required|string|in:CONTRIBUTION,SERVICE,INTERINSTITUTIONAL,RENTAL,LOAN,FINANCIAL,LEGAL",
    "debtor.name": "required|string",
    "debtor.email": "required|email",
    "debtor.phone": "required|string",
    //"debtor.address": "required|string",
    "debtor.debtorDNI": "required|string",
    description: "required|string",
    installments: "required|array",
    "installments.*.amount": "required|numeric",
    "installments.*.dueDate": "required|dateFormat:YYYY-MM-DD",
    financialConceptId: "required|string",
  }

  const v = new Validator(payload, rule)

  const matched = await v.check()

  if (!matched) {
    return res.status(HttpStatus.UNPROCESSABLE_ENTITY).send(v.errors)
  }

  next()
}
