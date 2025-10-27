import { AssetStatus } from "../enums/AssetStatus.enum"
import { AssetInventoryStatus } from "../enums/AssetInventoryStatus.enum"
import { AssetAttachment } from "../types/AssetAttachment.type"
import { AssetHistoryEntry } from "../types/AssetHistoryEntry.type"
import { AssetDisposalRecord } from "../types/AssetDisposal.type"
import { AssetResponsible } from "../types/AssetResponsible.type"
import { AssetInventoryChecker } from "../types/AssetInventoryChecker.type"

export type AssetModel = {
  assetId: string
  code: string
  name: string
  category: string
  acquisitionDate: Date
  value: number
  quantity: number
  churchId: string
  location: string
  responsibleId?: string
  responsible: AssetResponsible
  status: AssetStatus
  attachments: AssetAttachment[]
  history: AssetHistoryEntry[]
  inventoryStatus?: AssetInventoryStatus | null
  inventoryCheckedAt?: Date | null
  inventoryCheckedBy?: AssetInventoryChecker | null
  disposal?: AssetDisposalRecord | null
  createdAt: Date
  updatedAt: Date
}
