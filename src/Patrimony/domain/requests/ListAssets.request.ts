import { AssetStatus } from "../enums/AssetStatus.enum"

export type ListAssetsRequest = {
  churchId?: string
  category?: string
  status?: AssetStatus
  search?: string
  page?: number | string
  perPage?: number | string
  performedBy: string
}
