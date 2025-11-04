import { Logger } from "@/Shared/adapter"
import {
  AccountPayable,
  AccountPayableRequest,
  IAccountPayableRepository,
  ISupplierRepository,
} from "@/AccountsPayable/domain"
import { SupplierNotFound } from "@/AccountsPayable/domain/exceptions/SupplierNotFound"
import { IFinancialConceptRepository } from "@/Financial/domain/interfaces"
import { IQueueService } from "@/Shared/domain"

export class CreateAccountPayable {
  private logger = Logger(CreateAccountPayable.name)

  constructor(
    private readonly accountPayableRepository: IAccountPayableRepository,
    private readonly supplierRepository: ISupplierRepository,
    private readonly financialConceptRepository: IFinancialConceptRepository,
    private readonly queueService: IQueueService
  ) {}

  async execute(args: AccountPayableRequest) {
    this.logger.info(`Start Create Account Payable`, args)

    const supplier = await this.supplierRepository.one({
      supplierId: args.supplierId,
    })

    if (!supplier) {
      throw new SupplierNotFound()
    }

    const accountPayable = AccountPayable.create({
      ...args,
      supplier: {
        supplierId: supplier.getSupplierId(),
        supplierType: supplier.getType(),
        supplierDNI: supplier.getDNI(),
        name: supplier.getName(),
        phone: supplier.getPhone(),
      },
    })

    await this.accountPayableRepository.upsert(accountPayable)

    this.logger.info(`CreateAccountPayable finish`)
  }
}
