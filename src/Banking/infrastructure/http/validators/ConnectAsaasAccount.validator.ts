import { HttpStatus } from "@/Shared/domain"
import type {
  NextFunction,
  ServerRequest,
  ServerResponse,
} from "bun-platform-kit"
import { Validator } from "node-input-validator"

export default async (
  req: ServerRequest,
  res: ServerResponse,
  next: NextFunction
): Promise<void> => {
  const payload = req.body as any

  const rule = {
    apiKey: "required|string|minLength:6",
    connectionName: "required|string|minLength:4",
  }

  const v = new Validator(payload, rule)

  const matched = await v.check()

  if (!matched) {
    return res.status(HttpStatus.UNPROCESSABLE_ENTITY).send(v.errors)
  }

  next()
}
