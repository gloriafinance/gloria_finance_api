import { Validator } from "node-input-validator"
import { HttpStatus } from "@/Shared/domain"
import { Logger } from "@/Shared/adapter"

export default async (
  req: Request,
  res: ServerResponse,
  next: NextFunction
) => {
  const payload = req.body
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
