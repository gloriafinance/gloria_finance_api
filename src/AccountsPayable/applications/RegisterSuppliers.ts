import { Logger } from "@/Shared/adapter"
import {
  ISupplierRepository,
  Supplier,
  SupplierFound,
} from "@/AccountsPayable/domain"
import { ISupplier } from "@/AccountsPayable/domain/interfaces/Supplier"

export class RegisterSuppliers {
  private logger = Logger(RegisterSuppliers.name)

  constructor(private readonly supplierRepository: ISupplierRepository) {}

  async execute(req: ISupplier) {
    this.logger.info(`Start Register Supplier`, req)

    if (
      await this.supplierRepository.one({
        dni: req.dni,
      })
    ) {
      this.logger.info(`Supplier already exists`, req)
      throw new SupplierFound()
    }

    const supplier = Supplier.create(req)

    await this.supplierRepository.upsert(supplier)

    this.logger.info(`Register Supplier finish`)
  }
}
