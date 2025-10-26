import { AssetInventoryStatus } from "../enums/AssetInventoryStatus.enum"

export type RecordAssetInventoryRequest = {
  assetId: string
  status: AssetInventoryStatus
  checkedAt?: string
  notes?: string
  performedBy: string
}
