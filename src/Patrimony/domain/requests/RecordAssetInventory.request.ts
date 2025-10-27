import { AssetInventoryStatus } from "../enums/AssetInventoryStatus.enum"
import { AssetInventoryChecker } from "../types/AssetInventoryChecker.type"

export type RecordAssetInventoryRequest = {
  assetId: string
  status: AssetInventoryStatus
  checkedAt?: string
  code: string
  quantity: number
  notes?: string
  performedByDetails?: AssetInventoryChecker
}
