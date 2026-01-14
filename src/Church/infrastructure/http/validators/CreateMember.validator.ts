import { Logger } from "@/Shared/adapter"
import { HttpStatus } from "@/Shared/domain"
import { Validator } from "node-input-validator"

const logger = Logger("CreateMemberValidator")

export const CreateMemberValidator = async (
  req: Request,
  res: ServerResponse,
  next: NextFunction
): Promise<void> => {
  const payload = req.body

  logger.info("Validating create member payload", payload)

  const rules = {
    name: "required|maxLength:150",
    email: "required|email",
    phone: "required",
    dni: "required",
    conversionDate: "required|dateFormat:YYYY-MM-DD",
    baptismDate: "sometimes|dateFormat:YYYY-MM-DD",
    isTreasurer: "required|boolean",
    churchId: "required",
    birthdate: "required|dateFormat:YYYY-MM-DD",
    active: "required|boolean",
  }

  const v = new Validator(payload, rules)
  const matched = await v.check()

  if (!matched) {
    res.status(HttpStatus.UNPROCESSABLE_ENTITY).send(v.errors)
    return
  }

  next()
}
