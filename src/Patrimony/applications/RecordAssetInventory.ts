import { Logger } from "@/Shared/adapter"
import {
  AssetNotFoundException,
  AssetResponse,
  IAssetRepository,
  RecordAssetInventoryRequest,
} from "../domain"
import { mapAssetToResponse } from "./mappers/AssetResponse.mapper"

export class RecordAssetInventory {
  private readonly logger = Logger(RecordAssetInventory.name)

  constructor(private readonly repository: IAssetRepository) {}

  async execute(
    request: RecordAssetInventoryRequest
  ): Promise<AssetResponse> {
    this.logger.info("Recording physical inventory for asset", request)

    const asset = await this.repository.one({ assetId: request.assetId })

    if (!asset) {
      throw new AssetNotFoundException()
    }

    const checkedAt = request.checkedAt
      ? new Date(request.checkedAt)
      : undefined

    asset.markInventory({
      performedBy: request.performedBy,
      status: request.status,
      notes: request.notes,
      checkedAt,
    })

    await this.repository.upsert(asset)

    return mapAssetToResponse(asset)
  }
}
