import { AssetStatus } from "../enums/AssetStatus.enum"

export type PhysicalInventorySheetRequest = {
  churchId: string
  category?: string
  status?: AssetStatus
  performedBy: string
}
