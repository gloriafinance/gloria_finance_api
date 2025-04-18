import { NextFunction, Request, Response } from "express"
import { Logger } from "@/Shared/adapter"
import { Validator } from "node-input-validator"
import { HttpStatus } from "@/Shared/domain"

export default async (req: Request, res: Response, next: NextFunction) => {
  const payload = req.body
  const logger = Logger("RegisterSupplierValidator")

  logger.info(`Validating`, payload)

  const rule = {
    type: "required|string|in:SUPPLIER,SERVICE_PROVIDER,NATURAL_PERSON",
    dni: "required|string",
    name: "required|string",
    
    address: "required|object",
    "address.street": "required|string",
    "address.number": "required|string",
    "address.city": "required|string",
    "address.state": "required|string",
    "address.zipCode": "required|string",

    phone: "required|string",
  }

  const v = new Validator(payload, rule)
  const matched = await v.check()
  if (!matched) {
    return res.status(HttpStatus.UNPROCESSABLE_ENTITY).send(v.errors)
  }

  next()
}
