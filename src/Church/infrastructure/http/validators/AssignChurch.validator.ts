import { Validator } from "node-input-validator"
import { HttpStatus } from "@/Shared/domain"
import { Logger } from "@/Shared/adapter"
import type { ServerRequest, ServerResponse } from "bun-platform-kit"

export default async (req: ServerRequest, res: ServerResponse) => {
  const logger = Logger("AssingChurchValidator")

  const payload = req.body as any
  logger.info(`Validando asignacion de iglesia ${JSON.stringify(payload)}`)

  const rule = {
    churchId: "required",
    ministerId: "required",
  }

  const v = new Validator(payload, rule)

  const matched = await v.check()

  if (!matched) {
    return res.status(HttpStatus.UNPROCESSABLE_ENTITY).send(v.errors)
  }

  return true
}
