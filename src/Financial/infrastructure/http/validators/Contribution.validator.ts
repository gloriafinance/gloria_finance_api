import { Validator } from "node-input-validator"
import { HttpStatus } from "@/Shared/domain"
import { Logger } from "@/Shared/adapter"
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
  const logger = Logger("ContributionValidator")

  logger.info(`Validando contribucion`, payload)

  const rule = {
    amount: "required|numeric",
    financialConceptId: "string",
    contributionType: "required|string|in:OFFERING,TITHE",
    paidAt: "required|date",
    observation: "string",
  }

  const customMessage = {
    "type.in": "Invalid value, accepted values are: OFFERING, TITHE.",
  }

  const v = new Validator(payload, rule, customMessage)

  const matched = await v.check()

  if (!matched) {
    return res.status(HttpStatus.UNPROCESSABLE_ENTITY).send(v.errors)
  }

  next()
}
