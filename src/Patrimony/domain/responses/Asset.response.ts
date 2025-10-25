import { AssetModel } from "../models/Asset.model"

export type AssetResponse = AssetModel & {
  documentsPending: boolean
}
