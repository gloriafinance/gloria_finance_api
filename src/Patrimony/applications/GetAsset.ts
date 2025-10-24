import { Logger } from "@/Shared/adapter"
import { GetAssetRequest, IAssetRepository, AssetNotFoundException } from "../domain"
import { mapAssetToResponse } from "./mappers/AssetResponse.mapper"

export class GetAsset {
  private readonly logger = Logger(GetAsset.name)

  constructor(private readonly repository: IAssetRepository) {}

  async execute(request: GetAssetRequest) {
    this.logger.info("Fetching patrimony asset details", request)

    const asset = await this.repository.one({ assetId: request.assetId })

    if (!asset) {
      throw new AssetNotFoundException()
    }

    return mapAssetToResponse(asset)
  }
}
