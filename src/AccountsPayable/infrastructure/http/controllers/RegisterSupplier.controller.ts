import { ISupplier } from "@/AccountsPayable/domain/interfaces/Supplier"
import { Response } from "express"
import domainResponse from "@/Shared/helpers/domainResponse"

export const RegisterSupplierController = async (
  req: ISupplier,
  res: Response
) => {
  try {
  } catch (e) {
    domainResponse(e, res)
  }
}
