import { MongoRepository } from "@abejarano/ts-mongodb-criteria"
import {
  ConceptType,
  CostCenterMaster,
  FinancialRecordStatus,
} from "../../domain"
import { ICostCenterMasterRepository } from "../../domain/interfaces"
import { Logger } from "@/Shared/adapter"

export class CostCenterMasterMongoRepository
  extends MongoRepository<CostCenterMaster>
  implements ICostCenterMasterRepository
{
  private static instance: CostCenterMasterMongoRepository
  private dbCollectionName = "cost_centers_master"
  private logger = Logger(CostCenterMasterMongoRepository.name)

  static getInstance(): CostCenterMasterMongoRepository {
    if (!this.instance) {
      this.instance = new CostCenterMasterMongoRepository()
    }

    return this.instance
  }

  collectionName(): string {
    return this.dbCollectionName
  }

  async one(costCenterMasterId: string): Promise<CostCenterMaster | undefined> {
    const collection = await this.collection()
    const document = await collection.findOne({
      costCenterMasterId,
    })

    return document
      ? CostCenterMaster.fromPrimitives({
          ...document,
          id: document._id,
        })
      : undefined
  }

  async search(
    churchId: string,
    month: number,
    year: number
  ): Promise<CostCenterMaster[]> {
    const collection = await this.collection()
    const documents = await collection
      .find({
        churchId,
        month,
        year,
      })
      .toArray()

    return documents.map((document) =>
      CostCenterMaster.fromPrimitives({
        ...document,
        id: document._id,
      })
    )
  }

  async upsert(costCenterMaster: CostCenterMaster): Promise<void> {
    await this.persist(costCenterMaster.getId(), costCenterMaster)
  }

  async rebuildCostCentersMaster(filter: {
    churchId: string
    year: number
    month: number
  }): Promise<void> {
    this.logger.info(
      `Rebuilding cost_centers_master from financial_records with params: ${JSON.stringify(
        filter
      )}`
    )

    const { churchId, year, month } = filter

    // 1) Fuente: financial_records
    this.dbCollectionName = "financial_records"
    const financialRecordsCollection = await this.collection()

    const startDate = month
      ? new Date(Date.UTC(year, month - 1, 1))
      : new Date(Date.UTC(year, 0, 1))
    const endDate = month
      ? new Date(Date.UTC(year, month, 1))
      : new Date(Date.UTC(year + 1, 0, 1))

    const pipeline = [
      {
        $match: {
          churchId,
          date: { $gte: startDate, $lt: endDate },
          status: {
            $in: [
              FinancialRecordStatus.CLEARED,
              FinancialRecordStatus.RECONCILED,
            ],
          },
          costCenter: { $exists: true },
          $or: [
            { "financialConcept.affectsResult": true },
            { "financialConcept.affectsBalance": true }, // inclui CAPEX
          ],
          type: { $in: [ConceptType.OUTGO, ConceptType.PURCHASE] },
        },
      },
      {
        $project: {
          costCenter: "$costCenter",
          costCenterId: "$costCenter.costCenterId",
          amount: { $abs: "$amount" },
          date: "$date",
        },
      },
      {
        $group: {
          _id: "$costCenterId",
          costCenter: { $first: "$costCenter" },
          total: { $sum: "$amount" },
          lastMove: { $max: "$date" },
        },
      },
      {
        $project: {
          _id: 0,
          costCenterId: "$_id",
          costCenter: 1,
          total: 1,
          lastMove: 1,
        },
      },
    ]

    const aggregated = await financialRecordsCollection
      .aggregate(pipeline)
      .toArray()

    // 2) Escribir en cost_centers_master
    this.dbCollectionName = "cost_centers_master"
    const masterCollection = await this.collection()

    const deleteFilter: any = {
      churchId,
      year,
    }
    if (month !== undefined) {
      deleteFilter.month = month
    }

    await masterCollection.deleteMany(deleteFilter)

    if (!aggregated.length) {
      this.logger.info(
        `No cost centers found to rebuild for churchId=${churchId}, year=${year}, month=${month}`
      )
      return
    }

    const docsToInsert = aggregated.map((item) => {
      const center = item.costCenter ?? {}
      const costCenterId =
        item.costCenterId ?? center.costCenterId ?? "UNKNOWN_CENTER"

      const masterId = `${month ?? 0}-${year}-${costCenterId}`

      const doc: any = {
        churchId,
        costCenter: {
          costCenterId,
          costCenterName: center.costCenterName ?? center.name ?? "N/A",
        },
        costCenterMasterId: masterId,
        total: item.total ?? 0,
        lastMove: item.lastMove ?? new Date(),
        year,
      }

      if (month !== undefined) {
        doc.month = month
      }

      return doc
    })

    if (docsToInsert.length > 0) {
      await masterCollection.insertMany(docsToInsert)
    }

    this.logger.info(
      `Rebuilt cost_centers_master with ${docsToInsert.length} docs for churchId=${churchId}, year=${year}, month=${month}`
    )
  }

  async fetchCostCenters(filter: {
    churchId: string
    year: number
    month?: number
  }): Promise<CostCenterMaster[]> {
    this.logger.info(`Fetch costs center params: ${JSON.stringify(filter)}`)

    this.dbCollectionName = "cost_centers_master"

    const { churchId, year, month } = filter

    const collection = await this.collection()

    const mustConditions = [
      { text: { query: churchId, path: "churchId" } },
      { equals: { value: Number(year), path: "year" } },
    ]

    if (month !== undefined) {
      mustConditions.push({ equals: { value: Number(month), path: "month" } })
    }

    const result = await collection
      .aggregate([
        {
          $search: {
            index: "costCentersMasterIndex",
            compound: {
              must: mustConditions,
            },
          },
        },
      ])
      .toArray()

    return result.map((r) => CostCenterMaster.fromPrimitives(r))
  }
}
