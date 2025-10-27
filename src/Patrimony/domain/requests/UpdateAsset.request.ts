import { AssetStatus } from "../enums/AssetStatus.enum"
import { CreateAssetAttachmentRequest } from "./CreateAsset.request"

export type UpdateAssetRequest = {
  assetId: string
  name?: string
  category?: string
  value?: number
  quantity?: number
  acquisitionDate?: string
  churchId?: string
  location?: string
  responsibleId?: string
  status?: AssetStatus
  attachments?: CreateAssetAttachmentRequest[]
  attachmentsToRemove?: string[]
  performedByDetails: {
    memberId: string
    name: string
    email: string
  }
  notes?: string
}
