import { IJob, IStorageService } from "@/Shared/domain"
import { Logger } from "@/Shared/adapter"
import { IPurchaseRepository } from "@/Purchases/domain/interfaces"
import { Purchase } from "@/Purchases/domain"

export class DeletePurchasesJob implements IJob {
  private logger = Logger(DeletePurchasesJob.name)

  constructor(
    private readonly purchaseRepository: IPurchaseRepository,
    private storage: IStorageService
  ) {}

  async handle(args: { purchaseIds: string[] }): Promise<void> {
    this.logger.info(`DeletePurchases`, args)

    const purchases: Purchase[] = await this.purchaseRepository.list(
      args.purchaseIds
    )

    for (const purchase of purchases) {
      const patchFile = purchase.getInvoiceFile()
      await this.storage.deleteFile(patchFile)
    }

    await this.purchaseRepository.delete(args.purchaseIds)

    this.logger.info(`DeletePurchases completed`)
  }
}
