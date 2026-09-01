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
  const payload = req.body

  if (
    typeof payload !== "object" ||
    payload === null ||
    Array.isArray(payload) ||
    Object.keys(payload).some((key) => key !== "apiKey")
  ) {
    res.status(HttpStatus.UNPROCESSABLE_ENTITY).send({
      payload: {
        message: "Payload must contain only the apiKey field",
      },
    })
    return
  }

  const validator = new Validator(payload, {
    apiKey: "required|string|minLength:1",
  })

  if (!(await validator.check())) {
    res.status(HttpStatus.UNPROCESSABLE_ENTITY).send(validator.errors)
    return
  }

  const apiKey = (payload as { apiKey: string }).apiKey
  if (apiKey.trim() === "") {
    res.status(HttpStatus.UNPROCESSABLE_ENTITY).send({
      apiKey: {
        message: "The apiKey field is required",
      },
    })
    return
  }

  next()
}
