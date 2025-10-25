import { Asset, AssetPrimitives } from "../../domain/Asset"
import { AssetModel } from "../../domain/models/Asset.model"
import { AssetResponse } from "../../domain/responses/Asset.response"

export const mapAssetToResponse = (
  asset: Asset | AssetModel
): AssetResponse => {
  const base: AssetPrimitives | AssetModel =
    asset instanceof Asset ? asset.toPrimitives() : asset

  const assetId = asset instanceof Asset ? asset.getId() : asset.id

  const serialized: AssetModel = {
    ...base,
    ...(assetId ? { id: assetId } : {}),
  }

  return {
    ...serialized,
    documentsPending:
      !serialized.attachments || serialized.attachments.length === 0,
  }
}
