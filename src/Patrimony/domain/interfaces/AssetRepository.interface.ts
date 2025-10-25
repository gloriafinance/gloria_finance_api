import { Criteria, Paginate } from "@abejarano/ts-mongodb-criteria"
import { Asset } from "../Asset"
import { AssetModel } from "../models/Asset.model"
import { AssetListFilters } from "../types/AssetListFilters.type"

export interface IAssetRepository {
  upsert(asset: Asset): Promise<void>
  list(criteria: Criteria): Promise<Paginate<AssetModel>>
  one(filter: Record<string, unknown>): Promise<Asset | undefined>
  count(filters?: AssetListFilters): Promise<number>
  search(filters?: AssetListFilters): Promise<AssetModel[]>
}
