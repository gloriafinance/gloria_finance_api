import { AssetStatus } from "../enums/AssetStatus.enum"
import { AssetInventoryStatus } from "../enums/AssetInventoryStatus.enum"
import { AssetAttachment } from "../types/AssetAttachment.type"
import { AssetHistoryEntry } from "../types/AssetHistoryEntry.type"
import { AssetDisposalRecord } from "../types/AssetDisposal.type"

export type AssetModel = {
  id?: string
  assetId: string
  code: string
  name: string
  category: string
  acquisitionDate: Date
  value: number
  churchId: string
  location: string
  responsibleId: string
  status: AssetStatus
  attachments: AssetAttachment[]
  history: AssetHistoryEntry[]
  inventoryStatus?: AssetInventoryStatus | null
  inventoryCheckedAt?: Date | null
  inventoryCheckedBy?: string | null
  disposal?: AssetDisposalRecord | null
  createdAt: Date
  updatedAt: Date
}
