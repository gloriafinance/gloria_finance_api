import { Validator } from "node-input-validator"
import { HttpStatus } from "@/Shared/domain"
import { Logger } from "@/Shared/adapter"
import {
  NextFunction,
  ServerRequest,
  type ServerResponse,
} from "bun-platform-kit"

export default async (
  req: ServerRequest,
  res: ServerResponse,
  next: NextFunction
) => {
  const payload = req.body as any
  const logger = Logger("PayAccountPayableValidator")

  logger.info(`Validating  ${JSON.stringify(payload)}`)

  const rule = {
    accountPayableId: "required|string",
    installmentId: "required|string",
    availabilityAccountId: "required|string",
    costCenterId: "required|string",
    amount: "required|numeric",
  }

  const v = new Validator(payload, rule)

  const matched = await v.check()

  if (!matched) {
    return res.status(HttpStatus.UNPROCESSABLE_ENTITY).send(v.errors)
  }

  next()
}
