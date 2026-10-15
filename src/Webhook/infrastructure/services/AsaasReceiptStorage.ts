import { StorageProviderService } from "@/Shared/infrastructure/services/StorageProvider.service"
import type { IStorageService } from "@/Shared/domain"
import type { IRemoteReceiptStorage } from "@/Financial/domain/interfaces/RemoteReceiptStorage.interface"
import { Logger } from "@/Shared/adapter/CustomLogger"

/**
 * Adapter for the `IRemoteReceiptStorage` port. It owns the Asaas-specific
 * detail of turning a receipt reference into a downloadable PDF, so the
 * application layer never has to know how Asaas exposes receipts.
 */
export class AsaasReceiptStorage implements IRemoteReceiptStorage {
  private readonly logger = Logger(AsaasReceiptStorage.name)

  constructor(
    private readonly storage: IStorageService = StorageProviderService.getInstance()
  ) {}

  async storeRemoteReceipt(
    id: string,
    receiptUrl: string
  ): Promise<string | undefined> {
    const pdfUrl = await this.getAsaasReceiptPdfUrl(receiptUrl)
    const response = await fetch(pdfUrl)
    if (!response.ok) {
      this.logger.error("Error downloading Asaas receipt", {
        id,
        status: response.status,
      })
      return undefined
    }

    const contentType = response.headers.get("content-type")
    if (!contentType?.includes("application/pdf")) {
      this.logger.error("Expected PDF receipt", { id, contentType })
      return undefined
    }

    const buffer = Buffer.from(await response.arrayBuffer())
    return this.storage.uploadFile({
      data: buffer,
      mimetype: "application/pdf",
      originalname: `comprovante-${id}.pdf`,
    })
  }

  private async getAsaasReceiptPdfUrl(
    transactionReceiptUrl: string
  ): Promise<string> {
    const receiptUrl = new URL(transactionReceiptUrl)
    if (receiptUrl.hostname !== "www.asaas.com")
      throw new Error("Invalid Asaas receipt URL")
    const response = await fetch(receiptUrl)
    if (!response.ok)
      throw new Error(`Failed to fetch Asaas receipt page: ${response.status}`)
    const html = await response.text()
    const match = html.match(
      /href=["']([^"']*\/transactionReceipt\/pdf\/[^"']+)["']/i
    )
    if (!match) throw new Error("Asaas PDF receipt URL not found")
    return new URL(match[1]!, "https://www.asaas.com").toString()
  }
}
