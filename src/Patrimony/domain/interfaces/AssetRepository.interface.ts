import { Criteria } from "@abejarano/ts-mongodb-criteria"
import { Asset } from "../Asset"
import { AssetModel } from "../models/Asset.model"
import { AssetListFilters } from "../types/AssetListFilters.type"
import { AssetListResult } from "../types/AssetListResult.type"

export interface IAssetRepository {
  create(asset: Asset): Promise<void>
  update(asset: Asset): Promise<void>
  list(criteria: Criteria, pagination: { page: number; perPage: number }): Promise<AssetListResult>
  one(filter: object): Promise<Asset | undefined>
  findByCode(code: string): Promise<Asset | null>
  count(filters?: AssetListFilters): Promise<number>
  search(filters?: AssetListFilters): Promise<AssetModel[]>
}
