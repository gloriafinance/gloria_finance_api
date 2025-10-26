import {
  Criteria,
  MongoRepository,
  Paginate,
} from "@abejarano/ts-mongodb-criteria"
import { Filter } from "mongodb"
import {
  Asset,
  AssetListFilters,
  AssetModel,
  IAssetRepository,
} from "@/Patrimony"

export class AssetMongoRepository
  extends MongoRepository<Asset>
  implements IAssetRepository
{
  private static instance: AssetMongoRepository

  static getInstance(): AssetMongoRepository {
    if (!AssetMongoRepository.instance) {
      AssetMongoRepository.instance = new AssetMongoRepository()
    }

    return AssetMongoRepository.instance
  }

  collectionName(): string {
    return "patrimony_assets"
  }

  async upsert(asset: Asset): Promise<void> {
    await this.persist(asset.getId(), asset)
  }

  async list(criteria: Criteria): Promise<Paginate<AssetModel>> {
    const documents = await this.searchByCriteria(criteria)
    const paginated = await this.paginate(documents)

    return {
      ...paginated,
      results: paginated.results.map((doc) => this.mapToModel(doc)),
    }
  }

  async one(filter: Record<string, unknown>): Promise<Asset | undefined> {
    const collection = await this.collection()
    const document = await collection.findOne(filter)

    if (!document) {
      return undefined
    }

    return Asset.fromPrimitives(this.mapToPrimitives(document))
  }

  async count(filters?: AssetListFilters): Promise<number> {
    const collection = await this.collection()

    return await collection.countDocuments(this.buildQuery(filters))
  }

  async search(filters?: AssetListFilters): Promise<AssetModel[]> {
    const collection = await this.collection()
    const query = this.buildQuery(filters)
    const documents = await collection.find(query).sort({ name: 1 }).toArray()

    return documents.map((doc) => this.mapToModel(doc))
  }

  private buildQuery(filters?: AssetListFilters, search?: string): Filter<any> {
    const query: Filter<any> = {}

    if (filters?.churchId) {
      query.churchId = filters.churchId
    }

    if (filters?.category) {
      query.category = filters.category
    }

    if (filters?.status) {
      query.status = filters.status
    }

    if (search) {
      const regex = new RegExp(search, "i")
      query.$or = [
        { name: regex },
        { code: regex },
        { responsibleId: regex },
        { location: regex },
      ]
    }

    return query
  }

  private mapToModel(document: any): AssetModel {
    const attachments = (document.attachments ?? []).map((attachment) => ({
      ...attachment,
      uploadedAt: attachment.uploadedAt
        ? new Date(attachment.uploadedAt)
        : new Date(),
    }))

    const history = (document.history ?? []).map((entry) => ({
      ...entry,
      performedAt: entry.performedAt ? new Date(entry.performedAt) : new Date(),
    }))

    const disposal = document.disposal
      ? {
          ...document.disposal,
          occurredAt: document.disposal.occurredAt
            ? new Date(document.disposal.occurredAt)
            : new Date(),
        }
      : null

    return {
      id: document._id?.toString(),
      assetId: document.assetId,
      code: document.code,
      name: document.name,
      category: document.category,
      acquisitionDate: document.acquisitionDate
        ? new Date(document.acquisitionDate)
        : new Date(),
      value: Number(document.value ?? 0),
      churchId: document.churchId,
      location: document.location,
      responsibleId: document.responsibleId,
      status: document.status,
      attachments,
      history,
      inventoryStatus: document.inventoryStatus ?? null,
      inventoryCheckedAt: document.inventoryCheckedAt
        ? new Date(document.inventoryCheckedAt)
        : null,
      inventoryCheckedBy: document.inventoryCheckedBy ?? null,
      disposal,
      createdAt: document.createdAt ? new Date(document.createdAt) : new Date(),
      updatedAt: document.updatedAt ? new Date(document.updatedAt) : new Date(),
    }
  }

  private mapToPrimitives(document: any) {
    return {
      ...this.mapToModel(document),
    }
  }
}
