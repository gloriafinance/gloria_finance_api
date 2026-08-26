import { HttpStatus } from "@/Shared/domain"
import { Validator } from "node-input-validator"
import type { NextFunction, ServerResponse } from "bun-platform-kit"

export default async (
  req: Request,
  res: ServerResponse,
  next: NextFunction
): Promise<void> => {
  const validator = new Validator(req.body as object, {
    to: "required|string|minLength:10|maxLength:20",
  })

  if (!(await validator.check())) {
    res.status(HttpStatus.UNPROCESSABLE_ENTITY).send(validator.errors)
    return
  }

  next()
}
