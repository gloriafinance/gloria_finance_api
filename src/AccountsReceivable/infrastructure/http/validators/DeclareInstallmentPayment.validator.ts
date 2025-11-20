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

  const rule = {
    accountReceivableId: "required|string",
    installmentId: "required|string",
    debtorDNI: "required|string",
    availabilityAccountId: "required|string",
    amount: "required|numeric",
    voucher: "string",
  }

  const v = new Validator(payload, rule)

  const matched = await v.check()

  if (!matched) {
    return res.status(HttpStatus.UNPROCESSABLE_ENTITY).send(v.errors)
  }

  next()
}
