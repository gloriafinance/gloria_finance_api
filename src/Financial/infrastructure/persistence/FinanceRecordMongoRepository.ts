import { FinanceRecord } from "@/Financial/domain"
import type { IFinancialRecordRepository } from "../../domain/interfaces"
import {
  ConceptType,
  FinancialRecordStatus,
  StatementCategory,
  type StatementCategorySummary,
} from "../../domain"
import { Logger } from "@/Shared/adapter"
import { MongoRepository } from "@abejarano/ts-mongodb-criteria"
import { Collection } from "mongodb"

const REALIZED_STATUSES = [
  FinancialRecordStatus.CLEARED,
  FinancialRecordStatus.RECONCILED,
]

export class FinanceRecordMongoRepository
  extends MongoRepository<FinanceRecord>
  implements IFinancialRecordRepository
{
  private static instance: FinanceRecordMongoRepository
  private logger = Logger("FinanceRecordMongoRepository")
  private dbCollectionName = "financial_records"

  private constructor() {
    super(FinanceRecord)
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

  async deleteByFinancialRecordId(financialRecordId: string): Promise<void> {
    this.dbCollectionName = "financial_records"
    const collection = await this.collection()
    await collection.deleteOne({ financialRecordId })
  }

  async titheList(
    filter: object
  ): Promise<{ total: number; tithesOfTithes: number; records: any[] }> {
    this.dbCollectionName = "financial_records"

    const filters = {
      ...filter,
      status: { $in: REALIZED_STATUSES },
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
      total: result[0]!.total,
      records: result[0]!.records,
      tithesOfTithes: ((result[0]!.total ?? 0) * 10) / 100,
    }
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
      status: { $in: REALIZED_STATUSES },
      $or: [
        { "financialConcept.affectsResult": true },
        { "financialConcept.affectsBalance": true }, // incluye CAPEX
      ],
    }
    console.log(matchFilter)

    const result = await collection
      .aggregate([
        {
          $match: matchFilter,
        },
        {
          $project: {
            category: "$financialConcept.statementCategory",
            type: "$type",
            amount: { $abs: "$amount" },
            symbol: "$availabilityAccount.symbol",
          },
        },
        {
          $group: {
            _id: {
              category: "$category",
              symbol: "$symbol",
            },
            income: {
              $sum: {
                $cond: [{ $eq: ["$type", ConceptType.INCOME] }, "$amount", 0],
              },
            },
            expenses: {
              $sum: {
                $cond: [
                  {
                    $in: ["$type", [ConceptType.OUTGO, ConceptType.PURCHASE]],
                  },
                  "$amount",
                  0,
                ],
              },
            },
            reversal: {
              $sum: {
                $cond: [{ $eq: ["$type", ConceptType.REVERSAL] }, "$amount", 0],
              },
            },
          },
        },
        {
          $project: {
            _id: 0,
            category: "$_id.category",
            symbol: "$_id.symbol",
            income: 1,
            expenses: 1,
            reversal: 1,
          },
        },
      ])
      .toArray()

    return result.map((item) => ({
      category: item.category as StatementCategory,
      income: item.income ?? 0,
      expenses: item.expenses ?? 0,
      reversal: item.reversal ?? 0,
      symbol: item.symbol ?? undefined,
    }))
  }

  protected async ensureIndexes(collection: Collection): Promise<void> {
    await collection.createIndex(
      { financialRecordId: 1 },
      {
        unique: true,
        background: true,
        name: "idx_financialRecordId",
      }
    )

    await collection.createIndex(
      {
        churchId: 1,
        date: 1,
        status: 1,
        type: 1,
      },
      { background: true, name: "idx_full_record_scan" }
    )

    await collection.createIndex(
      {
        churchId: 1,
        date: 1,
        status: 1,
        "availabilityAccount.availabilityAccountId": 1,
        type: 1,
      },
      {
        name: "idx_cashflow",
        background: true,
        partialFilterExpression: {
          "financialConcept.affectsCashFlow": true,
          status: { $in: REALIZED_STATUSES },
        },
      }
    )

    await collection.createIndex(
      {
        churchId: 1,
        date: 1,
        status: 1,
        "financialConcept.statementCategory": 1,
      },
      {
        name: "idx_dre_core",
        background: true,
        partialFilterExpression: {
          status: { $in: REALIZED_STATUSES },
        },
      }
    )

    await collection.createIndex(
      {
        churchId: 1,
        date: 1,
        status: 1,
        "costCenter.costCenterId": 1,
      },
      {
        name: "idx_cost_centers",
        background: true,
        partialFilterExpression: {
          status: { $in: REALIZED_STATUSES },
          $or: [
            { "financialConcept.affectsResult": true },
            { "financialConcept.affectsBalance": true },
          ],
        },
      }
    )
  }
}
