import { FinanceRecord } from "@/Financial/domain/FinanceRecord"
import type { IFinancialRecordRepository } from "../../domain/interfaces"
import { ConceptType } from "@/FinanceConfig/domain/enums/ConcepType.enum"
import { FinancialRecordStatus } from "@/Financial/domain/enums/FinancialRecordType.enum"
import { StatementCategory } from "@/Financial/domain/enums/StatementCategory.enum"
import type { StatementCategorySummary } from "@/Financial/domain/types/StatementCategorySummary.type"
import { MongoRepository } from "@abejarano/ts-mongodb-criteria"
import { Collection } from "mongodb"

const REALIZED_STATUSES = [
  FinancialRecordStatus.CLEARED,
  FinancialRecordStatus.RECONCILED,
]
const INCOME_STATEMENT_INDEX = "idx_financial_records_income_statement"

export class FinanceRecordMongoRepository
  extends MongoRepository<FinanceRecord>
  implements IFinancialRecordRepository
{
  private static instance: FinanceRecordMongoRepository

  private constructor() {
    super(FinanceRecord)
  }

  static getInstance(): FinanceRecordMongoRepository {
    if (!FinanceRecordMongoRepository.instance) {
      FinanceRecordMongoRepository.instance = new FinanceRecordMongoRepository()
    }
    return FinanceRecordMongoRepository.instance
  }

  async deleteByFinancialRecordId(financialRecordId: string): Promise<void> {
    const collection = await this.collection()
    await collection.deleteOne({ financialRecordId })
  }

  async countRecurringPaymentRecords(
    recurringPaymentId: string,
    competence: string
  ): Promise<number> {
    const collection = await this.collection()
    return await collection.countDocuments({
      recurringPaymentId,
      recurringCompetence: competence,
    })
  }

  async findRecurringPayment(
    recurringPaymentId: string,
    competence: string
  ): Promise<FinanceRecord | undefined> {
    const collection = await this.collection()
    // A voided record no longer settles the competence, so it must not block
    // paying that competence again.
    const document = await collection.findOne({
      recurringPaymentId,
      recurringCompetence: competence,
      status: { $ne: FinancialRecordStatus.VOID },
    })
    return document ? FinanceRecord.fromPrimitives(document) : undefined
  }

  async listRecurringPaymentsForChurch(
    churchId: string,
    competence: string
  ): Promise<FinanceRecord[]> {
    const collection = await this.collection()
    const documents = await collection
      .find(
        { churchId, recurringCompetence: competence },
        {
          projection: {
            _id: 1,
            financialRecordId: 1,
            financialConcept: 1,
            churchId: 1,
            amount: 1,
            date: 1,
            type: 1,
            availabilityAccount: 1,
            voucher: 1,
            description: 1,
            costCenter: 1,
            status: 1,
            createdAt: 1,
            updatedAt: 1,
            source: 1,
            createdBy: 1,
            reference: 1,
            recurringPaymentId: 1,
            recurringCompetence: 1,
            bankingExternalReference: 1,
          },
        }
      )
      .toArray()
    return documents.map((document) => FinanceRecord.fromPrimitives(document))
  }

  async findByBankingExternalReference(
    reference: string
  ): Promise<FinanceRecord | undefined> {
    const collection = await this.collection()
    const document = await collection.findOne({
      bankingExternalReference: reference,
    })
    return document ? FinanceRecord.fromPrimitives(document) : undefined
  }

  async titheList(filter: object): Promise<{
    records: {
      amount: number
      date: Date
      availabilityAccountName: string
      availabilityAccountType: string
      symbol: string
    }[]
  }> {
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
            _id: null,
            records: {
              $push: {
                description: "$description",
                amount: "$amount",
                date: "$date",
                availabilityAccountName: "$availabilityAccount.accountName",
                availabilityAccountType: "$availabilityAccount.accountType",
                symbol: "$availabilityAccount.symbol",
              },
            },
          },
        },
      ])
      .toArray()

    if (result.length === 0) {
      return { records: [] }
    }

    return {
      records: result[0]!.records,
    }
  }

  async fetchStatementCategories(filter: {
    churchId: string
    year: number
    month?: number
  }): Promise<StatementCategorySummary[]> {
    const { churchId, year, month } = filter

    const collection = await this.collection()

    // The result period of a recurring payment is its competence, not the day the
    // money moved; everything else keeps selecting by `date`.
    const matchFilter: Record<string, unknown> = {
      churchId,
      status: { $in: REALIZED_STATUSES },
      $and: [
        {
          $or: [
            { "financialConcept.affectsResult": true },
            { "financialConcept.affectsBalance": true }, // incluye movimientos patrimoniales/balance
          ],
        },
        statementPeriodFilter({ year, month }),
      ],
    }

    const result = await collection
      .aggregate(
        [
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
                  $cond: [
                    { $eq: ["$type", ConceptType.REVERSAL] },
                    "$amount",
                    0,
                  ],
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
        ],
        {
          hint: INCOME_STATEMENT_INDEX,
          allowDiskUse: true,
        }
      )
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
      { recurringPaymentId: 1, recurringCompetence: 1 },
      {
        unique: true,
        name: "idx_financial_record_recurring_competence_unique",
        partialFilterExpression: {
          recurringPaymentId: { $exists: true },
          recurringCompetence: { $exists: true },
          // MongoDB allows only equality, $exists, ranges, $in, $and, $or, ...
          // in a partial filter, so voided records are excluded by enumerating
          // the statuses that do settle a competence rather than with $ne.
          status: {
            $in: [
              FinancialRecordStatus.PENDING,
              FinancialRecordStatus.CLEARED,
              FinancialRecordStatus.RECONCILED,
            ],
          },
        },
      }
    )
    await collection.createIndex(
      { churchId: 1, recurringCompetence: 1 },
      { name: "idx_financial_records_recurring_by_church_competence" }
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
        status: 1,
        date: 1,
        type: 1,
        "financialConcept.statementCategory": 1,
        "availabilityAccount.symbol": 1,
      },
      {
        name: INCOME_STATEMENT_INDEX,
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
