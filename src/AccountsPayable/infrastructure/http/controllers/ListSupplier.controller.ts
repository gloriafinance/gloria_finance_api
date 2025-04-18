import { Response } from "express"
import { HttpStatus } from "@/Shared/domain"
import { AllSupplier } from "@/AccountsPayable/applications"
import { SupplierMongoRepository } from "@/AccountsPayable/infrastructure/persistence"
import domainResponse from "@/Shared/helpers/domainResponse"

export const ListSupplierController = async (
  churchId: string,
  res: Response
) => {
  try {
    res
      .status(HttpStatus.OK)
      .json(
        await new AllSupplier(SupplierMongoRepository.getInstance()).execute(
          churchId
        )
      )
  } catch (e) {
    domainResponse(e, res)
  }
}
