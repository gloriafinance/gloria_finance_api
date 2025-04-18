import { ISupplier } from "@/AccountsPayable/domain/interfaces/Supplier"
import { Response } from "express"
import domainResponse from "@/Shared/helpers/domainResponse"
import { RegisterSuppliers } from "@/AccountsPayable/applications"
import { SupplierMongoRepository } from "@/AccountsPayable/infrastructure/persistence"
import { HttpStatus } from "@/Shared/domain"

export const RegisterSupplierController = async (
  req: ISupplier,
  res: Response
) => {
  try {
    await new RegisterSuppliers(SupplierMongoRepository.getInstance()).execute(
      req
    )

    res.status(HttpStatus.CREATED).json({
      message: "Successfully registered",
    })
  } catch (e) {
    domainResponse(e, res)
  }
}
