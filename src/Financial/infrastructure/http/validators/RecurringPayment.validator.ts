import { HttpStatus } from "@/Shared/domain"
import { Validator } from "node-input-validator"
import type {
  NextFunction,
  ServerRequest,
  ServerResponse,
} from "bun-platform-kit"

const PIX_TYPES = new Set(["CPF", "CNPJ", "EMAIL", "PHONE", "EVP"])

export async function validateRecurringPaymentConfiguration(
  req: ServerRequest,
  res: ServerResponse,
  next: NextFunction
): Promise<void> {
  const body: unknown = req.body
  if (
    !isRecord(body) ||
    !hasOnlyKeys(body, [
      "name",
      "financialConceptId",
      "type",
      "amount",
      "dayOfMonth",
      "payment",
      "status",
    ])
  ) {
    res
      .status(HttpStatus.UNPROCESSABLE_ENTITY)
      .send({ code: "RECURRING_PAYMENT_PAYLOAD_INVALID" })
    return
  }
  const payment = body.payment
  if (!isRecord(payment)) {
    res
      .status(HttpStatus.UNPROCESSABLE_ENTITY)
      .send({ code: "RECURRING_PAYMENT_PAYLOAD_INVALID" })
    return
  }

  const rules = {
    name: "required|string",
    financialConceptId: "required|string",
    type: "required|string|in:FIXED,VARIABLE",
    amount: body.type === "FIXED" ? "required|numeric" : "sometimes",
    dayOfMonth: "required|integer|min:1|max:31",
    "payment.method": "required|string|in:PIX,BILL",
    ...(payment.method === "PIX"
      ? {
          "payment.pixKey": "required|string",
          "payment.pixKeyType": `required|string|in:${[...PIX_TYPES].join(",")}`,
        }
      : {}),
    status: "sometimes|string|in:ACTIVE,INACTIVE",
  }
  const validator = new Validator(body, rules)
  if (!(await validator.check())) {
    res.status(HttpStatus.UNPROCESSABLE_ENTITY).send(validator.errors)
    return
  }

  const amountValid =
    body.type === "FIXED"
      ? typeof body.amount === "number" &&
        Number.isFinite(body.amount) &&
        body.amount > 0
      : body.type === "VARIABLE" && body.amount === undefined
  const paymentKeys =
    payment.method === "PIX" ? ["method", "pixKey", "pixKeyType"] : ["method"]
  const strictFieldsValid =
    typeof body.dayOfMonth === "number" &&
    amountValid &&
    hasOnlyKeys(payment, paymentKeys)
  if (!strictFieldsValid) {
    res
      .status(HttpStatus.UNPROCESSABLE_ENTITY)
      .send({ code: "RECURRING_PAYMENT_PAYLOAD_INVALID" })
    return
  }

  next()
}

export async function validatePayRecurringPayment(
  req: ServerRequest,
  res: ServerResponse,
  next: NextFunction
): Promise<void> {
  const body: unknown = req.body
  const valid =
    isRecord(body) &&
    hasOnlyKeys(body, ["competence", "amount", "identificationField"]) &&
    typeof body.competence === "string" &&
    /^\d{4}-(0[1-9]|1[0-2])$/.test(body.competence) &&
    (body.amount === undefined ||
      (typeof body.amount === "number" && Number.isFinite(body.amount))) &&
    (body.identificationField === undefined ||
      (typeof body.identificationField === "string" &&
        body.identificationField.trim() !== ""))
  if (!valid) {
    res
      .status(HttpStatus.UNPROCESSABLE_ENTITY)
      .send({ code: "RECURRING_PAYMENT_PAY_PAYLOAD_INVALID" })
    return
  }
  next()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowed: readonly string[]
): boolean {
  return Object.keys(value).every((key) => allowed.includes(key))
}
