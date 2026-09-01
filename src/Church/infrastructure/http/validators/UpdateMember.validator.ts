import { Logger } from "@/Shared/adapter"
import { HttpStatus } from "@/Shared/domain"
import { Validator } from "node-input-validator"
import type {
  NextFunction,
  ServerRequest,
  ServerResponse,
} from "bun-platform-kit"

const logger = Logger("UpdateMemberValidator")

export const UpdateMemberValidator = async (
  req: ServerRequest,
  res: ServerResponse,
  next: NextFunction
): Promise<void> => {
  const body = req.body as any

  const payload = { ...body, memberId: req.params.memberId }

  logger.info("Validating update member payload", payload)

  const rules: any = {
    memberId: "required",
    name: "sometimes|maxLength:150",
    email: "sometimes|email",
    phone: "sometimes",
    dni: "sometimes",
    conversionDate: "sometimes|dateFormat:YYYY-MM-DD",

    birthdate: "sometimes|dateFormat:YYYY-MM-DD",
    isTreasurer: "sometimes|boolean",
    status: "sometimes|in:APPROVED,INACTIVE",
  }

  if (body.baptismDate) {
    rules["baptismDate"] = "sometimes|dateFormat:YYYY-MM-DD"
  }

  const v = new Validator(payload, rules)
  const matched = await v.check()

  if (!matched) {
    res.status(HttpStatus.UNPROCESSABLE_ENTITY).send(v.errors)
    return
  }

  next()
}
