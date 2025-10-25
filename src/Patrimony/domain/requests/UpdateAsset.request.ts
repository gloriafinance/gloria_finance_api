import { AssetStatus } from "../enums/AssetStatus.enum"
import { CreateAssetAttachmentRequest } from "./CreateAsset.request"

export type UpdateAssetRequest = {
  assetId: string
  name?: string
  category?: string
  value?: number
  acquisitionDate?: string
  churchId?: string
  location?: string
  responsibleId?: string
  status?: AssetStatus
  attachments?: CreateAssetAttachmentRequest[]
  attachmentsToRemove?: string[]
  performedBy: string
  notes?: string
}
