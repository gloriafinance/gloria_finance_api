import { Response } from "express"
import { HttpStatus } from "@/Shared/domain"
import { AllSupplier, RegisterSuppliers } from "@/AccountsPayable/applications"
import { SupplierMongoRepository } from "@/AccountsPayable/infrastructure/persistence"
import domainResponse from "@/Shared/helpers/domainResponse"
import { CacheController } from "@/Shared/decorators"
import { ISupplier } from "@/AccountsPayable/domain/interfaces/Supplier"

export class SupplierController {
  @CacheController("suppliers", 600)
  static async listSupplier(churchId: string, res: Response) {
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

  static async registerSupplier(req: ISupplier, res: Response) {
    try {
      await new RegisterSuppliers(
        SupplierMongoRepository.getInstance()
      ).execute(req)

      res.status(HttpStatus.CREATED).json({
        message: "Successfully registered",
      })
    } catch (e) {
      domainResponse(e, res)
    }
  }
}
