import { ISupplierRepository } from "@/AccountsPayable/domain"

export class AllSupplier {
  constructor(private readonly supplierRepository: ISupplierRepository) {}

  async execute(churchId: string) {
    return await this.supplierRepository.all(churchId)
  }
}
