import { NextFunction, Request, Response } from "express"
import { Logger } from "@/Shared/adapter"
import { Validator } from "node-input-validator"
import { HttpStatus } from "@/Shared/domain"

export default async (req: Request, res: Response, next: NextFunction) => {
  const payload = req.body
  const logger = Logger("DeclareInstallmentPaymentValidator")

  logger.info(`Validating ${JSON.stringify(payload)}`)

  if (payload.amount) {
    payload.amount = Number(payload.amount)
  }

  if (!payload.file && req.files && "file" in req.files) {
    // Propaga el archivo subido para que la validación lo considere
    payload.file = (req.files as any).file
  }

  const rule = {
    accountReceivableId: "required|string",
    installmentId: "required|string",
    memberId: "string",
    availabilityAccountId: "required|string",
    amount: "required|numeric",
    voucher: "string",
    file: "required",
  }

  const v = new Validator(payload, rule)

  const matched = await v.check()

  if (!matched) {
    return res.status(HttpStatus.UNPROCESSABLE_ENTITY).send(v.errors)
  }

  next()
}
