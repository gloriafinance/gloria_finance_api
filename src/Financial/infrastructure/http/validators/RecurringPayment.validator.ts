import { HttpStatus } from "@/Shared/domain"
import { Validator } from "node-input-validator"
import type {
  NextFunction,
  ServerRequest,
  ServerResponse,
} from "bun-platform-kit"

const PIX_TYPES = new Set(["CPF", "CNPJ", "EMAIL", "PHONE", "EVP"])
const COMPETENCE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/
const PAYMENT_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function invalid(res: ServerResponse, code: string): void {
  res.status(HttpStatus.UNPROCESSABLE_ENTITY).send({ code })
}

/**
 * Permanent configuration. Accepts no payment method: PIX/BILL is decided per
 * execution. `costCenterId` is required — every expense is imputed.
 */
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
      "costCenterId",
      "type",
      "amount",
      "dayOfMonth",
      "pixDestination",
      "status",
    ])
  ) {
    invalid(res, "RECURRING_PAYMENT_PAYLOAD_INVALID")
    return
  }

  const pixDestination = body.pixDestination
  if (
    pixDestination !== undefined &&
    (!isRecord(pixDestination) ||
      !hasOnlyKeys(pixDestination, ["pixKey", "pixKeyType"]))
  ) {
    invalid(res, "RECURRING_PAYMENT_PAYLOAD_INVALID")
    return
  }

  const rules = {
    name: "required|string",
    financialConceptId: "required|string",
    costCenterId: "required|string",
    type: "required|string|in:FIXED,VARIABLE",
    amount: body.type === "FIXED" ? "required|numeric" : "sometimes",
    dayOfMonth: "required|integer|min:1|max:31",
    ...(pixDestination
      ? {
          "pixDestination.pixKey": "required|string",
          "pixDestination.pixKeyType": `required|string|in:${[...PIX_TYPES].join(",")}`,
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
  if (typeof body.dayOfMonth !== "number" || !amountValid) {
    invalid(res, "RECURRING_PAYMENT_PAYLOAD_INVALID")
    return
  }

  next()
}

/**
 * Banking execution. `amount` is forbidden for FIXED and required for VARIABLE
 * (enforced by the use case, which owns the configured amount). `payment`
 * describes this operation only and is never persisted.
 */
export async function validatePayRecurringPayment(
  req: ServerRequest,
  res: ServerResponse,
  next: NextFunction
): Promise<void> {
  const body: unknown = req.body
  const valid =
    isRecord(body) &&
    hasOnlyKeys(body, [
      "competence",
      "amount",
      "payment",
      "availabilityAccountId",
    ]) &&
    typeof body.competence === "string" &&
    COMPETENCE_PATTERN.test(body.competence) &&
    optionalAmount(body.amount) &&
    optionalReference(body.availabilityAccountId) &&
    validPaymentMethod(body.payment)
  if (!valid) {
    invalid(res, "RECURRING_PAYMENT_PAY_PAYLOAD_INVALID")
    return
  }
  next()
}

export async function validatePayRecurringPaymentPixQr(
  req: ServerRequest,
  res: ServerResponse,
  next: NextFunction
): Promise<void> {
  const body: unknown = req.body
  const valid =
    isRecord(body) &&
    hasOnlyKeys(body, [
      "competence",
      "amount",
      "payment",
      "availabilityAccountId",
    ]) &&
    typeof body.competence === "string" &&
    COMPETENCE_PATTERN.test(body.competence) &&
    optionalAmount(body.amount) &&
    optionalReference(body.availabilityAccountId) &&
    isRecord(body.payment) &&
    hasOnlyKeys(body.payment, ["type", "payload"]) &&
    body.payment.type === "PIX_QR" &&
    typeof body.payment.payload === "string" &&
    body.payment.payload.trim() !== ""
  if (!valid) {
    invalid(res, "RECURRING_PAYMENT_PAY_PAYLOAD_INVALID")
    return
  }
  next()
}

/**
 * Boleto simulation. The boleto is identified by exactly one of the typed line
 * or the barcode; no amount, account or church is accepted, because the account
 * comes from the path and the church from the authenticated request.
 */
export async function validateSimulateRecurringPaymentBill(
  req: ServerRequest,
  res: ServerResponse,
  next: NextFunction
): Promise<void> {
  const body: unknown = req.body
  const hasIdentificationField =
    isRecord(body) && nonBlankString(body.identificationField)
  const hasBarCode = isRecord(body) && nonBlankString(body.barCode)
  const valid =
    isRecord(body) &&
    hasOnlyKeys(body, ["identificationField", "barCode"]) &&
    hasIdentificationField !== hasBarCode
  if (!valid) {
    res.status(HttpStatus.BAD_REQUEST).send({
      code: "RECURRING_PAYMENT_BILL_SIMULATION_PAYLOAD_INVALID",
    })
    return
  }
  next()
}

export async function validateDecodeRecurringPaymentPixQr(
  req: ServerRequest,
  res: ServerResponse,
  next: NextFunction
): Promise<void> {
  const validator = new Validator(req.body, {
    payload: "required|string",
  })
  if (!(await validator.check())) {
    res.status(HttpStatus.UNPROCESSABLE_ENTITY).send(validator.errors)
    return
  }
  next()
}

/**
 * Manual execution. The voucher file is mandatory; body fields and the uploaded
 * file arrive together as multipart/form-data. A manual payment needs bank
 * reconciliation, so it does not start as a settled record.
 */
export async function validateRegisterRecurringPayment(
  req: ServerRequest,
  res: ServerResponse,
  next: NextFunction
): Promise<void> {
  const body: unknown = req.body
  if (
    !isRecord(body) ||
    !hasOnlyKeys(body, [
      "competence",
      "amount",
      "paymentDate",
      "availabilityAccountId",
    ])
  ) {
    invalid(res, "RECURRING_PAYMENT_REGISTER_PAYLOAD_INVALID")
    return
  }

  const paymentDate = body.paymentDate
  const paymentDateValid =
    typeof paymentDate === "string" &&
    PAYMENT_DATE_PATTERN.test(paymentDate) &&
    !Number.isNaN(new Date(`${paymentDate}T00:00:00.000Z`).getTime())
  if (!paymentDateValid) {
    invalid(res, "RECURRING_PAYMENT_REGISTER_PAYLOAD_INVALID")
    return
  }

  const valid =
    typeof body.competence === "string" &&
    COMPETENCE_PATTERN.test(body.competence) &&
    optionalAmount(body.amount) &&
    typeof body.availabilityAccountId === "string" &&
    body.availabilityAccountId.trim() !== ""
  if (!valid) {
    invalid(res, "RECURRING_PAYMENT_REGISTER_PAYLOAD_INVALID")
    return
  }
  next()
}

function validPaymentMethod(value: unknown): boolean {
  if (value === undefined) return true
  if (!isRecord(value)) return false
  if (value.type === "PIX") {
    return (
      hasOnlyKeys(value, ["type", "pixKey", "pixKeyType"]) &&
      typeof value.pixKey === "string" &&
      value.pixKey.trim() !== "" &&
      typeof value.pixKeyType === "string" &&
      PIX_TYPES.has(value.pixKeyType)
    )
  }
  if (value.type === "BILL") {
    return (
      hasOnlyKeys(value, ["type", "identificationField"]) &&
      typeof value.identificationField === "string" &&
      value.identificationField.trim() !== ""
    )
  }
  if (value.type === "PIX_QR") {
    return (
      hasOnlyKeys(value, ["type", "payload"]) &&
      typeof value.payload === "string" &&
      value.payload.trim() !== ""
    )
  }
  return false
}

function optionalAmount(value: unknown): boolean {
  return (
    value === undefined || (typeof value === "number" && Number.isFinite(value))
  )
}

function optionalReference(value: unknown): boolean {
  return (
    value === undefined || (typeof value === "string" && value.trim() !== "")
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function nonBlankString(value: unknown): boolean {
  return typeof value === "string" && value.trim() !== ""
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowed: readonly string[]
): boolean {
  return Object.keys(value).every((key) => allowed.includes(key))
}
