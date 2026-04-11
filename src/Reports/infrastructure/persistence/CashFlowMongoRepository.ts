import { MongoRepository } from "@abejarano/ts-mongodb-criteria"
import { FinanceRecord } from "@/Financial/domain"
import type { Collection, Document, Filter } from "mongodb"
import type {
  CashFlowBucketDetail,
  CashFlowBucketDetailsFilters,
  CashFlowFilters,
  CashFlowGroupBy,
  CashFlowProjectionResult,
  CashFlowReportResult,
  CashFlowSeriesRow,
  ICashFlowRepository,
} from "@/Reports/domain"

const INVALID_FINANCE_RECORD_DATE = new Date("1970-01-01T00:00:00.000Z")

const DEFAULT_PROJECTION_BUCKETS: Record<CashFlowGroupBy, number> = {
  day: 7,
  week: 4,
  month: 3,
}

type CashFlowNormalizedFilters = Omit<
  CashFlowFilters,
  "availabilityAccountId" | "includeProjection" | "projectionBuckets"
> & {
  availabilityAccountIds?: string[]
  includeProjection: boolean
  projectionBuckets: number
}

type CashFlowBucketAggregate = {
  period: Date
  entries: number
  exits: number
  net: number
}

const getDateTruncUnit = (
  groupBy: CashFlowGroupBy
): "day" | "week" | "month" => {
  if (groupBy === "day") return "day"
  if (groupBy === "week") return "week"
  return "month"
}

const roundAmount = (value: number): number => {
  const rounded = Math.round((Number(value) || 0) * 100) / 100
  return Object.is(rounded, -0) ? 0 : rounded
}

const normalizeStringArray = (
  value?: string | string[]
): string[] | undefined => {
  if (value === undefined || value === null) {
    return undefined
  }

  const items = (Array.isArray(value) ? value : [value])
    .flatMap((entry) => String(entry).split(","))
    .map((entry) => entry.trim())
    .filter(Boolean)

  return items.length > 0 ? Array.from(new Set(items)) : undefined
}

const truncateDateToBucket = (date: Date, groupBy: CashFlowGroupBy): Date => {
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth()
  const day = date.getUTCDate()

  if (groupBy === "month") {
    return new Date(Date.UTC(year, month, 1, 0, 0, 0, 0))
  }

  if (groupBy === "week") {
    const start = new Date(Date.UTC(year, month, day, 0, 0, 0, 0))
    start.setUTCDate(start.getUTCDate() - start.getUTCDay())
    return start
  }

  return new Date(Date.UTC(year, month, day, 0, 0, 0, 0))
}

const addBuckets = (
  date: Date,
  groupBy: CashFlowGroupBy,
  count: number
): Date => {
  const next = new Date(date.getTime())

  if (groupBy === "month") {
    return new Date(
      Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + count, 1, 0, 0, 0, 0)
    )
  }

  if (groupBy === "week") {
    next.setUTCDate(next.getUTCDate() + count * 7)
    return next
  }

  next.setUTCDate(next.getUTCDate() + count)
  return next
}

const subtractMonthsUtc = (date: Date, months: number): Date =>
  new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth() - months,
      date.getUTCDate(),
      0,
      0,
      0,
      0
    )
  )

export class CashFlowMongoRepository
  extends MongoRepository<FinanceRecord>
  implements ICashFlowRepository
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
    rawFilters: CashFlowFilters
  ): Promise<CashFlowReportResult> {
    const filters = this.normalizeFilters(rawFilters)
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
    const lastSeriesRow = series.at(-1)

    const summary = {
      openingBalance,
      entries: summaryRow?.entries ?? 0,
      exits: summaryRow?.exits ?? 0,
      net: summaryRow?.net ?? 0,
      closingBalance: lastSeriesRow
        ? lastSeriesRow.runningBalance
        : roundAmount(openingBalance + (summaryRow?.net ?? 0)),
    }

    const projection = await this.buildProjection(
      collection,
      filters,
      summary.closingBalance,
      series
    )

    return {
      summary,
      series,
      projection,
    }
  }

  async getCashFlowBucketDetails(
    rawFilters: CashFlowBucketDetailsFilters
  ): Promise<CashFlowBucketDetail[]> {
    const filters = this.normalizeFilters(rawFilters)
    const collection = await this.collection()

    return await collection
      .aggregate<CashFlowBucketDetail>(
        this.buildCashFlowBucketDetailsPipeline(
          filters,
          filters.startDate,
          filters.endDate
        )
      )
      .toArray()
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
      "costCenter.costCenterId": 1,
      status: 1,
      date: 1,
    })
  }

  private normalizeFilters(
    rawFilters: CashFlowFilters
  ): CashFlowNormalizedFilters {
    return {
      ...rawFilters,
      availabilityAccountIds: normalizeStringArray(
        rawFilters.availabilityAccountId
      ),
      includeProjection: rawFilters.includeProjection === true,
      projectionBuckets:
        rawFilters.projectionBuckets && rawFilters.projectionBuckets > 0
          ? rawFilters.projectionBuckets
          : DEFAULT_PROJECTION_BUCKETS[rawFilters.groupBy],
    }
  }

  private async buildProjection(
    collection: Collection,
    filters: CashFlowNormalizedFilters,
    closingBalance: number,
    series: CashFlowSeriesRow[]
  ): Promise<CashFlowProjectionResult> {
    if (!filters.includeProjection) {
      return {
        status: "unavailable",
        historicalMonthCount: 0,
        buckets: [],
      }
    }

    const historicalStartDate = subtractMonthsUtc(filters.endDate, 3)
    const historicalBuckets = await collection
      .aggregate<CashFlowBucketAggregate>(
        this.buildBucketAggregatePipeline(
          filters,
          historicalStartDate,
          filters.endDate
        )
      )
      .toArray()

    if (historicalBuckets.length === 0) {
      return {
        status: "unavailable",
        historicalMonthCount: 0,
        buckets: [],
      }
    }

    const entriesAverage = roundAmount(
      historicalBuckets.reduce((sum, row) => sum + row.entries, 0) /
        historicalBuckets.length
    )
    const exitsAverage = roundAmount(
      historicalBuckets.reduce((sum, row) => sum + row.exits, 0) /
        historicalBuckets.length
    )
    const netAverage = roundAmount(entriesAverage - exitsAverage)

    const uniqueMonths = new Set(
      historicalBuckets.map(
        (row) =>
          `${row.period.getUTCFullYear()}-${row.period.getUTCMonth() + 1}`
      )
    ).size

    const status = uniqueMonths >= 3 ? "available" : "degraded"

    const lastRealizedRow = series.at(-1)
    const anchorDate =
      lastRealizedRow?.period ??
      truncateDateToBucket(filters.endDate, filters.groupBy)

    const buckets = []
    let previousBalance = closingBalance

    for (let index = 1; index <= filters.projectionBuckets; index++) {
      const period = addBuckets(anchorDate, filters.groupBy, index)
      const projectedBalance = roundAmount(previousBalance + netAverage)

      buckets.push({
        period,
        projectedEntries: entriesAverage,
        projectedExits: exitsAverage,
        projectedNet: netAverage,
        projectedBalance,
      })

      previousBalance = projectedBalance
    }

    return {
      status,
      historicalMonthCount: uniqueMonths,
      buckets,
    }
  }

  private buildCashFlowSummaryPipeline(
    filters: CashFlowNormalizedFilters
  ): Document[] {
    return [
      {
        $match: this.buildMatchWithDateRange(
          filters,
          filters.startDate,
          filters.endDate
        ),
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
    filters: CashFlowNormalizedFilters,
    bucketStartDate: Date,
    bucketEndDate: Date
  ): Document[] {
    return [
      {
        $match: this.buildMatchWithDateRange(
          filters,
          bucketStartDate,
          bucketEndDate
        ),
      },
      {
        $project: {
          _id: 0,
          financialRecordId: 1,
          date: 1,
          description: 1,
          amount: { $round: ["$amount", 2] },
          type: 1,
          flowType: {
            $cond: [{ $in: ["$type", ["OUTGO", "PURCHASE"]] }, "exit", "entry"],
          },
          status: 1,
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

  private buildOpeningBalancePipeline(filters: CashFlowNormalizedFilters) {
    return [
      {
        $match: this.buildDateMatch({
          ...this.buildBaseMatch(filters),
          date: {
            $lt: filters.startDate,
          },
        }),
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
    filters: CashFlowNormalizedFilters,
    openingBalance: number
  ): Document[] {
    const unit = getDateTruncUnit(filters.groupBy)

    return [
      {
        $match: this.buildMatchWithDateRange(
          filters,
          filters.startDate,
          filters.endDate
        ),
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
                  case: { $eq: ["$type", "INCOME"] },
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

  private buildBucketAggregatePipeline(
    filters: CashFlowNormalizedFilters,
    startDate: Date,
    endDate: Date
  ): Document[] {
    const unit = getDateTruncUnit(filters.groupBy)

    return [
      {
        $match: this.buildMatchWithDateRange(filters, startDate, endDate),
      },
      {
        $group: {
          _id: {
            $dateTrunc: {
              date: "$date",
              unit,
              timezone: "UTC",
            },
          },
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
          period: "$_id",
          entries: { $round: ["$entries", 2] },
          exits: { $round: ["$exits", 2] },
          net: {
            $round: [{ $subtract: ["$entries", "$exits"] }, 2],
          },
        },
      },
      { $sort: { period: 1 } },
    ]
  }

  private buildBaseMatch(filters: CashFlowNormalizedFilters): Filter<Document> {
    const match: Filter<Document> = {
      churchId: filters.churchId,
      status: { $in: ["CLEARED", "RECONCILED"] },
      "financialConcept.affectsCashFlow": true,
      amount: { $type: "number" },
    }

    if (filters.availabilityAccountIds?.length) {
      match["availabilityAccount.availabilityAccountId"] = {
        $in: filters.availabilityAccountIds,
      }
    }

    if (filters.symbol) {
      match["availabilityAccount.symbol"] = filters.symbol
    }

    if (filters.method) {
      match["availabilityAccount.accountType"] = filters.method
    }

    if (filters.costCenterId) {
      match["costCenter.costCenterId"] = filters.costCenterId
    }

    return match
  }

  private buildMatchWithDateRange(
    filters: CashFlowNormalizedFilters,
    startDate: Date,
    endDate: Date
  ): Filter<Document> {
    return this.buildDateMatch({
      ...this.buildBaseMatch(filters),
      date: {
        $gte: startDate,
        $lte: endDate,
      },
    })
  }

  private buildDateMatch(match: Filter<Document>): Filter<Document> {
    return {
      ...match,
      date: {
        ...((match.date as Record<string, unknown>) ?? {}),
        $ne: INVALID_FINANCE_RECORD_DATE,
      },
    }
  }
}
