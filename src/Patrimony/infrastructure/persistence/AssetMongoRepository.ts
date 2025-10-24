import { Criteria, MongoRepository, OrderTypes } from "@abejarano/ts-mongodb-criteria"
import { Filter } from "mongodb"
import { Asset } from "../../domain/Asset"
import {
  AssetListFilters,
  AssetListResult,
  AssetModel,
  IAssetRepository,
} from "../../domain"

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

  async create(asset: Asset): Promise<void> {
    await this.persist(asset.getId(), asset)
  }

  async update(asset: Asset): Promise<void> {
    await this.persist(asset.getId(), asset)
  }

  async list(
    criteria: Criteria,
    pagination: { page: number; perPage: number }
  ): Promise<AssetListResult> {
    const { filters, search } = this.parseCriteria(criteria)
    const { page, perPage } = this.normalizePagination(pagination)
    const collection = await this.collection()
    const query = this.buildQuery(filters, search)
    const sort = this.buildSort(criteria)

    const skip = (page - 1) * perPage

    const documents = await collection
      .find(query)
      .sort(sort)
      .skip(skip)
      .limit(perPage)
      .toArray()

    const count = await collection.countDocuments(query)

    const results = documents.map((doc) => this.mapToModel(doc))

    const hasNext = skip + results.length < count

    return {
      results,
      count,
      nextPag: hasNext ? page + 1 : null,
      page,
      perPage,
    }
  }

  async one(filter: object): Promise<Asset | undefined> {
    const collection = await this.collection()
    const document = await collection.findOne(filter)

    if (!document) {
      return undefined
    }

    return Asset.fromPrimitives(this.mapToPrimitives(document))
  }

  async findByCode(code: string): Promise<Asset | null> {
    const collection = await this.collection()
    const document = await collection.findOne({ code })

    if (!document) {
      return null
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
    const documents = await collection
      .find(query)
      .sort({ name: 1 })
      .toArray()

    return documents.map((doc) => this.mapToModel(doc))
  }

  private buildQuery(filters?: AssetListFilters, search?: string): Filter<any> {
    const query: Filter<any> = {}

    if (filters?.congregationId) {
      query.congregationId = filters.congregationId
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

  private parseCriteria(criteria: Criteria): {
    filters: AssetListFilters
    search?: string
  } {
    const filters: AssetListFilters = {}
    let search: string | undefined

    const rawFilters =
      ((criteria as unknown as { filters?: { filters?: Array<Map<string, unknown>> } })
        ?.filters?.filters ?? []) as Array<Map<string, unknown>>

    for (const filter of rawFilters) {
      const field = filter?.get ? filter.get("field") : undefined
      const value = filter?.get ? filter.get("value") : undefined

      if (!field) {
        continue
      }

      if (field === "congregationId") {
        filters.congregationId = value as string
        continue
      }

      if (field === "category") {
        filters.category = value as string
        continue
      }

      if (field === "status") {
        filters.status = value as AssetListFilters["status"]
        continue
      }

      if (field === "$or" && Array.isArray(value) && value.length > 0) {
        const first = value.find((item) => item && typeof item === "object") as
          | Record<string, unknown>
          | undefined

        if (!first) {
          continue
        }

        const clauseValue = first[Object.keys(first)[0] ?? ""] as unknown

        if (clauseValue instanceof RegExp) {
          search = clauseValue.source
          continue
        }

        if (
          clauseValue &&
          typeof clauseValue === "object" &&
          "$regex" in (clauseValue as Record<string, unknown>)
        ) {
          const regexValue = (clauseValue as Record<string, unknown>)["$regex"]

          if (typeof regexValue === "string") {
            search = regexValue
          }
        }
      }
    }

    return { filters, search }
  }

  private buildSort(criteria: Criteria): Record<string, 1 | -1> {
    const rawOrder = (criteria as unknown as {
      order?: {
        orderBy?: { value?: string } | string
        orderType?: { value?: string } | string
      }
    })?.order

    const field =
      (typeof rawOrder?.orderBy === "string"
        ? rawOrder?.orderBy
        : rawOrder?.orderBy?.value) ?? "createdAt"

    const direction =
      (typeof rawOrder?.orderType === "string"
        ? rawOrder?.orderType
        : rawOrder?.orderType?.value) ?? OrderTypes.DESC

    const normalizedDirection = String(direction).toUpperCase()

    return {
      [field]: normalizedDirection === "ASC" ? 1 : -1,
    }
  }

  private normalizePagination(pagination: {
    page: number
    perPage: number
  }): { page: number; perPage: number } {
    const parsedPerPage = Number(pagination.perPage)
    const parsedPage = Number(pagination.page)

    const perPage = Number.isFinite(parsedPerPage)
      ? Math.max(parsedPerPage, 1)
      : 20
    const page = Number.isFinite(parsedPage) ? Math.max(parsedPage, 1) : 1

    return { page, perPage }
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
      congregationId: document.congregationId,
      location: document.location,
      responsibleId: document.responsibleId,
      status: document.status,
      attachments,
      history,
      inventoryCheckedAt: document.inventoryCheckedAt
        ? new Date(document.inventoryCheckedAt)
        : null,
      inventoryCheckedBy: document.inventoryCheckedBy ?? null,
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
