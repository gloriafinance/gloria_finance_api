import { IRepository } from "@abejarano/ts-mongodb-criteria"
import { Asset } from "../Asset"
import { AssetListFilters, AssetModel } from "@/Patrimony"

export interface IAssetRepository extends IRepository<Asset> {
  count(filters?: AssetListFilters): Promise<number>

  search(filters?: AssetListFilters): Promise<AssetModel[]>
}
