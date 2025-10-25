import { AssetStatus } from "../enums/AssetStatus.enum"

export type AssetListFilters = {
  churchId?: string
  category?: string
  status?: AssetStatus
}
