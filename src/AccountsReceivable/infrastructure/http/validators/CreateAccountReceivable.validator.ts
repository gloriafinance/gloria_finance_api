import { Logger } from "@/Shared/adapter"
import { Validator } from "node-input-validator"
import { HttpStatus } from "@/Shared/domain"
import type {
  NextFunction,
  ServerRequest,
  ServerResponse,
} from "bun-platform-kit"

export default async (
  req: ServerRequest,
  res: ServerResponse,
  next: NextFunction
) => {
  const payload = req.body as any
  const logger = Logger("CreateAccountReceivableValidator")

  logger.info(`Validating  ${JSON.stringify(payload)}`)

  if (typeof payload.installments === "string") {
    payload.installments = JSON.parse(payload.installments)
  }

  if (typeof payload.debtor === "string") {
    payload.debtor = JSON.parse(payload.debtor)
  }

  const rule: Record<string, string> = {
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

  if (payload.type === "CONTRIBUTION") {
    delete rule["installments.*.amount"]
  }

  const v = new Validator(payload, rule)

  const matched = await v.check()

  if (!matched) {
    return res.status(HttpStatus.UNPROCESSABLE_ENTITY).send(v.errors)
  }

  req.body = payload

  next()
}
