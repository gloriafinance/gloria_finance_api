import { AssetStatus } from "../enums/AssetStatus.enum"

export type CreateAssetAttachmentRequest = {
  name: string
  url?: string
  mimetype?: string
  size?: number
  file?: any
}

export type CreateAssetRequest = {
  name: string
  category: string
  value: number
  acquisitionDate: string
  churchId: string
  location: string
  responsibleId: string
  serialNumber: string
  status?: AssetStatus
  attachments?: CreateAssetAttachmentRequest[]
  performedBy: string
  notes?: string
}
