import { FinanceRecord } from "@/Financial/domain"
import { IFinancialRecordRepository } from "../../domain/interfaces"
import {
  AvailabilityAccountMaster,
  ConceptType,
  CostCenterMaster,
  StatementCategory,
  StatementCategorySummary,
} from "../../domain"
import { Logger } from "@/Shared/adapter"
import {
  Criteria,
  MongoRepository,
  Paginate,
} from "@abejarano/ts-mongodb-criteria"

export class FinanceRecordMongoRepository
  extends MongoRepository<FinanceRecord>
  implements IFinancialRecordRepository
{
  private static instance: FinanceRecordMongoRepository
  private logger = Logger("FinanceRecordMongoRepository")
  private dbCollectionName = "financial_records"

  constructor() {
    super()
  }

  static getInstance(): FinanceRecordMongoRepository {
    if (!FinanceRecordMongoRepository.instance) {
      FinanceRecordMongoRepository.instance = new FinanceRecordMongoRepository()
    }
    return FinanceRecordMongoRepository.instance
  }

  collectionName(): string {
    return this.dbCollectionName
  }

  async one(filter: object): Promise<FinanceRecord | undefined> {
    const collection = await this.collection()
    const result = await collection.findOne(filter)
    if (!result) {
      return undefined
    }

    return FinanceRecord.fromPrimitives(result)
  }

  async fetch(criteria: Criteria): Promise<Paginate<FinanceRecord>> {
    this.dbCollectionName = "financial_records"
    const result: FinanceRecord[] =
      await this.searchByCriteria<FinanceRecord>(criteria)

    return this.paginate<FinanceRecord>(result)
  }

  async upsert(financialRecord: FinanceRecord): Promise<void> {
    this.dbCollectionName = "financial_records"
    await this.persist(financialRecord.getId(), financialRecord)
  }

  async titheList(filter: {
    churchId: string
    year: number
    month: number
  }): Promise<{ total: number; tithesOfTithes: number; records: any[] }> {
    this.dbCollectionName = "financial_records"
    const { churchId, year, month } = filter

    const startDate = new Date(Date.UTC(year, month - 1, 1))
    const endDate = new Date(Date.UTC(year, month, 1))

    const filters = {
      churchId,
      date: {
        $gte: startDate,
        $lt: endDate,
      },
      "financialConcept.name": { $regex: "Dízimos" },
      type: ConceptType.INCOME,
    }

    const collection = await this.collection()

    const result = await collection
      .aggregate([
        {
          $match: filters,
        },
        {
          $group: {
            _id: null, // No queremos agrupar por un campo específico
            total: { $sum: "$amount" }, // Sumamos el campo "amount"
            records: {
              $push: {
                amount: "$amount",
                date: "$date",
                availabilityAccountName: "$availabilityAccount.accountName",
                availabilityAccountType: "$availabilityAccount.accountType",
              },
            },
          },
        },
      ])
      .toArray()

    if (result.length === 0) {
      return { total: 0, tithesOfTithes: 0, records: [] }
    }

    return {
      total: result[0].total,
      records: result[0].records,
      tithesOfTithes: ((result[0].total ?? 0) * 10) / 100,
    }
  }

  async fetchAvailableAccounts(filter: {
    churchId: string
    year: number
    month?: number
  }): Promise<AvailabilityAccountMaster[]> {
    this.logger.info(
      `Fetch available accounts params: ${JSON.stringify(filter)}`
    )

    this.dbCollectionName = "availability_accounts_master"

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
            index: "availabilityAccountMasterIndex",
            compound: {
              must: mustConditions,
            },
          },
        },
      ])
      .toArray()

    return result.map((r) => AvailabilityAccountMaster.fromPrimitives(r))
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

  async fetchStatementCategories(filter: {
    churchId: string
    year: number
    month?: number
  }): Promise<StatementCategorySummary[]> {
    this.logger.info(
      `Fetch statement categories params: ${JSON.stringify(filter)}`
    )

    this.dbCollectionName = "financial_records"

    const { churchId, year, month } = filter

    const collection = await this.collection()

    const startDate = month
      ? new Date(Date.UTC(year, month - 1, 1))
      : new Date(Date.UTC(year, 0, 1))
    const endDate = month
      ? new Date(Date.UTC(year, month, 1))
      : new Date(Date.UTC(year + 1, 0, 1))

    const matchFilter: Record<string, unknown> = {
      churchId,
      date: {
        $gte: startDate,
        $lt: endDate,
      },
    }

    const result = await collection
      .aggregate([
        {
          $match: matchFilter,
        },
        {
          $group: {
            _id: {
              category: {
                $ifNull: [
                  "$financialConcept.statementCategory",
                  StatementCategory.OTHER,
                ],
              },
              type: "$type",
            },
            total: { $sum: "$amount" },
          },
        },
        {
          $group: {
            _id: "$_id.category",
            income: {
              $sum: {
                $cond: [
                  {
                    $in: [
                      "$_id.type",
                      [ConceptType.INCOME, ConceptType.REVERSAL],
                    ],
                  },
                  "$total",
                  0,
                ],
              },
            },
            expenses: {
              $sum: {
                $cond: [
                  {
                    $in: [
                      "$_id.type",
                      [ConceptType.DISCHARGE, ConceptType.PURCHASE],
                    ],
                  },
                  "$total",
                  0,
                ],
              },
            },
          },
        },
        {
          $project: {
            _id: 0,
            category: "$_id",
            income: 1,
            expenses: 1,
          },
        },
      ])
      .toArray()

    return result.map((item) => ({
      category: item.category as StatementCategory,
      income: item.income ?? 0,
      expenses: item.expenses ?? 0,
    }))
  }
}
