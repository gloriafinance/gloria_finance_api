import { AssetStatus } from "../enums/AssetStatus.enum"

export type CreateAssetAttachmentRequest = {
  name: string
  url?: string
  mimetype?: string
  size?: number
  file?: any
}

export type CreateAssetRequest = {
  code: string
  name: string
  category: string
  value: number
  quantity: number
  acquisitionDate: string
  churchId: string
  location: string
  responsibleId: string
  serialNumber: string
  status?: AssetStatus
  attachments?: CreateAssetAttachmentRequest[]
  performedByDetails: {
    memberId: string
    name: string
    email: string
  }
  notes?: string
}
