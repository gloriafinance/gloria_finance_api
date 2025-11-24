import { IAvailabilityAccountMasterRepository } from "../../domain/interfaces"
import {
  AvailabilityAccountMaster,
  ConceptType,
  FinancialRecordStatus,
} from "../../domain"
import { MongoRepository } from "@abejarano/ts-mongodb-criteria"
import { Logger } from "@/Shared/adapter"

export class AvailabilityAccountMasterMongoRepository
  extends MongoRepository<AvailabilityAccountMaster>
  implements IAvailabilityAccountMasterRepository
{
  private static instance: AvailabilityAccountMasterMongoRepository
  private dbCollectionName = "availability_accounts_master"
  private logger = Logger(AvailabilityAccountMasterMongoRepository.name)

  constructor() {
    super()
  }

  static getInstance(): AvailabilityAccountMasterMongoRepository {
    if (!AvailabilityAccountMasterMongoRepository.instance) {
      AvailabilityAccountMasterMongoRepository.instance =
        new AvailabilityAccountMasterMongoRepository()
    }
    return AvailabilityAccountMasterMongoRepository.instance
  }

  collectionName(): string {
    return this.dbCollectionName
  }

  async one(
    availabilityAccountMasterId: string
  ): Promise<AvailabilityAccountMaster | undefined> {
    const collection = await this.collection()
    const document = await collection.findOne({
      availabilityAccountMasterId,
    })
    return document
      ? AvailabilityAccountMaster.fromPrimitives({
          ...document,
          id: document._id,
        })
      : undefined
  }

  async upsert(accountMaster: AvailabilityAccountMaster): Promise<void> {
    const collection = await this.collection()

    await collection.updateOne(
      {
        availabilityAccountMasterId:
          accountMaster.getAvailabilityAccountMasterId(),
      },
      { $set: accountMaster.toPrimitives() },
      { upsert: true }
    )
  }

  async search(
    churchId: string,
    month: number,
    year: number
  ): Promise<AvailabilityAccountMaster[] | undefined> {
    const collection = await this.collection()

    const documents = await collection
      .aggregate([
        {
          $search: {
            index: "availabilityAccountMasterIndex",
            compound: {
              must: [
                { text: { query: churchId, path: "churchId" } },
                { equals: { value: month, path: "month" } },
                { equals: { value: year, path: "year" } },
              ],
            },
          },
        },
      ])
      .toArray()

    if (!documents) {
      return undefined
    }

    return documents.map((document) =>
      AvailabilityAccountMaster.fromPrimitives({
        ...document,
        id: document._id,
      })
    )
  }

  async rebuildAvailabilityAccountsMaster(filter: {
    churchId: string
    year: number
    month: number
  }): Promise<void> {
    this.logger.info(
      `Rebuilding availability_accounts_master from financial_records with params: ${JSON.stringify(
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
          status: {
            $in: [
              FinancialRecordStatus.CLEARED,
              FinancialRecordStatus.RECONCILED,
            ],
          },
          date: { $gte: startDate, $lt: endDate },
          availabilityAccount: { $exists: true },
          "financialConcept.affectsCashFlow": true,
        },
      },
      {
        $project: {
          availabilityAccount: "$availabilityAccount",
          type: "$type",
          absAmount: { $abs: "$amount" },
        },
      },
      {
        $group: {
          _id: "$availabilityAccount.availabilityAccountId",
          availabilityAccount: { $first: "$availabilityAccount" },

          income: {
            $sum: {
              $cond: [{ $eq: ["$type", ConceptType.INCOME] }, "$absAmount", 0],
            },
          },
          reversal: {
            $sum: {
              $cond: [
                { $eq: ["$type", ConceptType.REVERSAL] },
                "$absAmount",
                0,
              ],
            },
          },
          totalOutput: {
            $sum: {
              $cond: [
                {
                  $in: ["$type", [ConceptType.OUTGO, ConceptType.PURCHASE]],
                },
                "$absAmount",
                0,
              ],
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          availabilityAccount: 1,
          availabilityAccountId: "$availabilityAccount.availabilityAccountId",
          totalInput: { $subtract: ["$income", "$reversal"] },
          totalOutput: 1,
        },
      },
    ]

    const aggregated = await financialRecordsCollection
      .aggregate(pipeline)
      .toArray()

    // 2) Escribir en availability_accounts_master
    this.dbCollectionName = "availability_accounts_master"
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
        `No availability accounts found to rebuild for churchId=${churchId}, year=${year}, month=${month}`
      )
      return
    }

    const docsToInsert = aggregated.map((item) => {
      const account = item.availabilityAccount ?? {}
      const availabilityAccountId =
        item.availabilityAccountId ??
        account.availabilityAccountId ??
        "UNKNOWN_ACCOUNT"

      const masterId = `${month ?? 0}-${year}-${availabilityAccountId}`

      const doc: any = {
        availabilityAccountMasterId: masterId,
        availabilityAccount: {
          availabilityAccountId,
          accountName: account.accountName ?? "N/A",
          symbol: account.symbol ?? "",
        },
        churchId,
        year,
        totalInput: item.totalInput ?? 0,
        totalOutput: item.totalOutput ?? 0,
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
      `Rebuilt availability_accounts_master with ${docsToInsert.length} docs for churchId=${churchId}, year=${year}, month=${month}`
    )
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
}
