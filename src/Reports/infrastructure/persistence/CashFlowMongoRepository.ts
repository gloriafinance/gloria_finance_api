import { MongoRepository } from "@abejarano/ts-mongodb-criteria"
import { FinanceRecord } from "@/Financial/domain"
import type { Collection, Document, Filter } from "mongodb"
import type {
  CashFlowFilters,
  CashFlowGroupBy,
  CashFlowReportResult,
  CashFlowSeriesRow,
  ICasFlowRepository,
} from "@/Reports/domain"

const getDateTruncUnit = (
  groupBy: CashFlowGroupBy
): "day" | "week" | "month" => {
  if (groupBy === "day") return "day"
  if (groupBy === "week") return "week"
  return "month"
}
export class CashFlowMongoRepository
  extends MongoRepository<FinanceRecord>
  implements ICasFlowRepository
{
  private static instance: CashFlowMongoRepository

  constructor() {
    super(FinanceRecord)
  }

  static getInstance(): CashFlowMongoRepository {
    if (CashFlowMongoRepository.instance) {
      return CashFlowMongoRepository.instance
    }
    CashFlowMongoRepository.instance = new CashFlowMongoRepository()
    return CashFlowMongoRepository.instance
  }

  override collectionName(): string {
    return "financial_records"
  }

  async getCashFlowDirectReport(
    filters: CashFlowFilters
  ): Promise<CashFlowReportResult> {
    const collection = await this.collection()
    const [openingRow] = await collection
      .aggregate<{
        openingBalance: number
      }>(this.buildOpeningBalancePipeline(filters))
      .toArray()

    const openingBalance = openingRow?.openingBalance ?? 0

    const [summaryRow] = await collection
      .aggregate<{
        entries: number
        exits: number
        net: number
      }>(this.buildCashFlowSummaryPipeline(filters))
      .toArray()

    const series = await collection
      .aggregate<CashFlowSeriesRow>(
        this.buildCashFlowSeriesPipeline(filters, openingBalance)
      )
      .toArray()

    const entries = summaryRow?.entries ?? 0
    const exits = summaryRow?.exits ?? 0
    const net = summaryRow?.net ?? 0
    const closingBalance =
      series.length > 0
        ? series[series.length - 1].runningBalance
        : Number((openingBalance + net).toFixed(2))

    return {
      openingBalance,
      entries,
      exits,
      net,
      closingBalance,
      series,
    }
  }

  protected override async ensureIndexes(
    collection: Collection
  ): Promise<void> {
    await collection.createIndex({
      churchId: 1,
      status: 1,
      date: 1,
    })

    await collection.createIndex({
      churchId: 1,
      "availabilityAccount.availabilityAccountId": 1,
      status: 1,
      date: 1,
    })

    await collection.createIndex({
      churchId: 1,
      "financialConcept.financialConceptId": 1,
      status: 1,
      date: 1,
    })
  }

  private buildCashFlowSummaryPipeline(filters: CashFlowFilters): Document[] {
    const match = this.buildBaseMatch(filters)

    return [
      {
        $match: {
          ...match,
          date: {
            $gte: filters.startDate,
            $lte: filters.endDate,
            $ne: new Date("1970-01-01T00:00:00.000Z"),
          },
        },
      },
      {
        $group: {
          _id: null,
          entries: {
            $sum: {
              $cond: [
                { $in: ["$type", ["INCOME", "INIT_BALANCE"]] },
                "$amount",
                0,
              ],
            },
          },
          exits: {
            $sum: {
              $cond: [{ $in: ["$type", ["OUTGO", "PURCHASE"]] }, "$amount", 0],
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          entries: { $round: ["$entries", 2] },
          exits: { $round: ["$exits", 2] },
          net: {
            $round: [{ $subtract: ["$entries", "$exits"] }, 2],
          },
        },
      },
    ]
  }

  private buildCashFlowBucketDetailsPipeline(
    filters: CashFlowFilters
  ): Document[] {
    const match: Filter<Document> = this.buildBaseMatch(filters)

    return [
      { $match: match },
      {
        $project: {
          _id: 0,
          financialRecordId: 1,
          date: 1,
          description: 1,
          amount: { $round: ["$amount", 2] },
          type: 1,
          status: 1,
          method: "$moneyLocation",
          accountId: "$availabilityAccount.availabilityAccountId",
          accountName: "$availabilityAccount.accountName",
          accountType: "$availabilityAccount.accountType",
          categoryId: "$financialConcept.financialConceptId",
          categoryName: "$financialConcept.name",
          categoryType: "$financialConcept.type",
          statementCategory: "$financialConcept.statementCategory",
          costCenterId: "$costCenter.costCenterId",
          costCenterName: "$costCenter.name",
          voucher: 1,
        },
      },
      { $sort: { date: 1, financialRecordId: 1 } },
    ]
  }
  private buildOpeningBalancePipeline(filters: CashFlowFilters) {
    const match = this.buildBaseMatch(filters)

    return [
      {
        $match: {
          ...match,
          date: {
            $lt: filters.startDate,
            $ne: new Date("1970-01-01T00:00:00.000Z"),
          },
        },
      },
      {
        $addFields: {
          signedAmount: {
            $switch: {
              branches: [
                {
                  case: { $in: ["$type", ["INCOME", "INIT_BALANCE"]] },
                  then: "$amount",
                },
                {
                  case: { $in: ["$type", ["OUTGO", "PURCHASE"]] },
                  then: { $multiply: ["$amount", -1] },
                },
              ],
              default: 0,
            },
          },
        },
      },
      {
        $group: {
          _id: null,
          openingBalance: { $sum: "$signedAmount" },
        },
      },
      {
        $project: {
          _id: 0,
          openingBalance: { $round: ["$openingBalance", 2] },
        },
      },
    ]
  }

  private buildCashFlowSeriesPipeline(
    filters: CashFlowFilters,
    openingBalance: number
  ): Document[] {
    const match = this.buildBaseMatch(filters)
    const unit = getDateTruncUnit(filters.groupBy)

    return [
      {
        $match: {
          ...match,
          // excluye registros basura obvios
          date: {
            $gte: filters.startDate,
            $lte: filters.endDate,
            $ne: new Date("1970-01-01T00:00:00.000Z"),
          },
        },
      },
      {
        $addFields: {
          bucket: {
            $dateTrunc: {
              date: "$date",
              unit,
              timezone: "UTC",
            },
          },
          normalizedType: {
            $switch: {
              branches: [
                {
                  case: { $in: ["$type", ["INCOME"]] },
                  then: "INCOME",
                },
                {
                  case: { $in: ["$type", ["OUTGO", "PURCHASE"]] },
                  then: "OUTGO",
                },
                {
                  case: { $eq: ["$type", "INIT_BALANCE"] },
                  then: "INIT_BALANCE",
                },
              ],
              default: "IGNORE",
            },
          },
        },
      },
      {
        $match: {
          normalizedType: { $in: ["INCOME", "OUTGO", "INIT_BALANCE"] },
        },
      },
      {
        $group: {
          _id: "$bucket",
          entries: {
            $sum: {
              $cond: [
                { $in: ["$normalizedType", ["INCOME", "INIT_BALANCE"]] },
                "$amount",
                0,
              ],
            },
          },
          exits: {
            $sum: {
              $cond: [{ $eq: ["$normalizedType", "OUTGO"] }, "$amount", 0],
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          period: "$_id",
          entries: { $round: ["$entries", 2] },
          exits: { $round: ["$exits", 2] },
          net: {
            $round: [{ $subtract: ["$entries", "$exits"] }, 2],
          },
        },
      },
      { $sort: { period: 1 } },
      {
        $setWindowFields: {
          sortBy: { period: 1 },
          output: {
            runningNet: {
              $sum: "$net",
              window: {
                documents: ["unbounded", "current"],
              },
            },
          },
        },
      },
      {
        $addFields: {
          runningBalance: {
            $round: [{ $add: [openingBalance, "$runningNet"] }, 2],
          },
        },
      },
      {
        $project: {
          period: 1,
          entries: 1,
          exits: 1,
          net: 1,
          runningBalance: 1,
        },
      },
    ]
  }

  private buildBaseMatch(filters: CashFlowFilters): Filter<Document> {
    const match: Filter<Document> = {
      churchId: filters.churchId,
      status: "CLEARED",
      "financialConcept.affectsCashFlow": true,
      date: {
        $gte: filters.startDate,
        $lte: filters.endDate,
      },
      amount: { $type: "number" },
    }

    if (filters.availabilityAccountId) {
      match["availabilityAccount.availabilityAccountId"] =
        filters.availabilityAccountId
    }

    if (filters.financialConceptId) {
      match["financialConcept.financialConceptId"] = filters.financialConceptId
    }

    if (filters.costCenterId) {
      match["costCenter.costCenterId"] = filters.costCenterId
    }

    if (filters.accountType) {
      match["availabilityAccount.accountType"] = filters.accountType
    }

    return match
  }
}
