export { Asset, type AssetPrimitives } from "./Asset"
export { AssetStatus, AssetStatusLabels } from "./enums/AssetStatus.enum"
export type { AssetAttachment } from "./types/AssetAttachment.type"
export type { AssetHistoryEntry } from "./types/AssetHistoryEntry.type"
export type { AssetModel } from "./models/Asset.model"
export type { AssetListFilters } from "./types/AssetListFilters.type"
export type {
  CreateAssetRequest,
  CreateAssetAttachmentRequest,
} from "./requests/CreateAsset.request"
export type { UpdateAssetRequest } from "./requests/UpdateAsset.request"
export type { ListAssetsRequest } from "./requests/ListAssets.request"
export type {
  InventoryReportRequest,
  InventoryReportFormat,
} from "./requests/InventoryReport.request"
export type { GetAssetRequest } from "./requests/GetAsset.request"
export { AssetNotFoundException } from "./exceptions/AssetNotFound.exception"

export { type IAssetRepository } from "./interfaces/AssetRepository.interface"
export type { AssetResponse } from "./responses"
export { AssetCodeGenerator } from "./services/AssetCodeGenerator"
