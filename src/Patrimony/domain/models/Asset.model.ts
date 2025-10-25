import { AssetStatus } from "../enums/AssetStatus.enum"
import { AssetAttachment } from "../types/AssetAttachment.type"
import { AssetHistoryEntry } from "../types/AssetHistoryEntry.type"

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
  inventoryCheckedAt?: Date | null
  inventoryCheckedBy?: string | null
  createdAt: Date
  updatedAt: Date
}
