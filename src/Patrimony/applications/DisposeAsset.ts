import { Logger } from "@/Shared/adapter"
import {
  AssetNotFoundException,
  AssetResponse,
  DisposeAssetRequest,
  IAssetRepository,
} from "../domain"
import { mapAssetToResponse } from "./mappers/AssetResponse.mapper"

export class DisposeAsset {
  private readonly logger = Logger(DisposeAsset.name)

  constructor(private readonly repository: IAssetRepository) {}

  async execute(request: DisposeAssetRequest): Promise<AssetResponse> {
    this.logger.info("Disposing patrimony asset", request)

    const asset = await this.repository.one({ assetId: request.assetId })

    if (!asset) {
      throw new AssetNotFoundException()
    }

    const occurredAt = request.disposedAt
      ? new Date(request.disposedAt)
      : undefined

    asset.dispose({
      status: request.status,
      reason: request.reason,
      notes: request.observations,
      performedByDetails: request.performedByDetails,
      occurredAt,
    })

    await this.repository.upsert(asset)

    return mapAssetToResponse(asset)
  }
}
