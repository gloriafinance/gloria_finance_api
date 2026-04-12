import { Logger } from "@/Shared/adapter"
import { HttpStatus } from "@/Shared/domain"
import { Validator } from "node-input-validator"
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
  const logger = Logger("PurchaseValidator")

  logger.info(`Validating purchase`, payload)

  // Normalizamos los datos `items` si están en el formato `items[0][...]`
  if (!Array.isArray(payload.items)) {
    payload.items = Object.keys(payload)
      .filter((key) => key.startsWith("items["))
      .reduce((acc, key) => {
        const match = key.match(/items\[(\d+)\]\[(\w+)\]/)
        if (match) {
          const [_, index, field] = match
          acc[index] = acc[index] || {}
          acc[index][field] = payload[key]
        }
        return acc
      }, [])
  }

  const rule = {
    financialConceptId: "required|string",
    purchaseDate: "required|dateFormat:YYYY-MM-DD",
    total: "required|numeric",
    tax: "required|numeric",
    description: "required|string",
    items: "required|array",
    "items.*.quantity": "required|numeric",
    "items.*.price": "required|numeric",
    "items.*.name": "required|string",
    availabilityAccountId: "required|string",
  }
  const v = new Validator(payload, rule)

  const matched = await v.check()

  if (!matched) {
    return res.status(HttpStatus.UNPROCESSABLE_ENTITY).send(v.errors)
  }

  next()
}
