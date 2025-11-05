import { Logger } from "@/Shared/adapter/CustomLogger"
import {
  BankStatement,
  BankStatementStatus,
  IBankStatementRepository,
} from "@/banking/domain"
import { MongoRepository } from "@abejarano/ts-mongodb-criteria"

const COLLECTION_NAME = "bank_statements"

export class BankStatementMongoRepository
  extends MongoRepository<BankStatement>
  implements IBankStatementRepository
{
  private static instance: BankStatementMongoRepository
  private readonly logger = Logger(BankStatementMongoRepository.name)
  private constructor() {
    super()
  }

  static getInstance(): BankStatementMongoRepository {
    if (!BankStatementMongoRepository.instance) {
      BankStatementMongoRepository.instance = new BankStatementMongoRepository()
    }

    return BankStatementMongoRepository.instance
  }

  collectionName(): string {
    return COLLECTION_NAME
  }

  async upsert(statement: BankStatement): Promise<void> {
    await this.persist(statement.getBankStatementId(), statement)
  }

  async bulkInsert(statements: BankStatement[]): Promise<void> {
    if (statements.length === 0) {
      return
    }

    const collection = await this.collection()
    const documents = statements.map((statement) => statement.toPrimitives())

    try {
      await collection.insertMany(documents as any[], { ordered: false })
    } catch (error: unknown) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code: number }).code === 11000
      ) {
        this.logger.info(
          "Duplicate bank statements ignored during bulk insert"
        )
        return
      }

      throw error
    }
  }

  async findByFitId(
    churchId: string,
    bank: string,
    fitId: string
  ): Promise<BankStatement | undefined> {
    const collection = await this.collection()
    const result = await collection.findOne({
      churchId,
      bank,
      fitId,
    })

    if (!result) {
      return undefined
    }

    return BankStatement.fromPrimitives(result as any)
  }

  async findByHash(
    churchId: string,
    bank: string,
    hash: string
  ): Promise<BankStatement | undefined> {
    const collection = await this.collection()
    const result = await collection.findOne({
      churchId,
      bank,
      hash,
    })

    if (!result) {
      return undefined
    }

    return BankStatement.fromPrimitives(result as any)
  }

  async updateStatus(
    statementId: string,
    status: BankStatementStatus,
    financialRecordId?: string
  ): Promise<void> {
    const collection = await this.collection()
    const now = new Date()
    const update: Record<string, unknown> = {
      reconciliationStatus: status,
      updatedAt: now,
    }

    const operations: Record<string, any> = {
      $set: update,
    }

    if (financialRecordId) {
      operations.$set.financialRecordId = financialRecordId
      operations.$set.reconciledAt = now
    } else if (status !== BankStatementStatus.RECONCILED) {
      operations.$unset = {
        financialRecordId: "",
        reconciledAt: "",
      }
    }

    await collection.updateOne({ bankStatementId: statementId }, operations)
  }

  async findById(
    churchId: string,
    bankStatementId: string
  ): Promise<BankStatement | undefined> {
    const collection = await this.collection()
    const result = await collection.findOne({
      churchId,
      bankStatementId,
    })

    if (!result) {
      return undefined
    }

    return BankStatement.fromPrimitives(result as any)
  }

  async list(params: {
    churchId: string
    bank?: string
    status?: BankStatementStatus
    month?: number
    year?: number
    dateFrom?: Date
    dateTo?: Date
  }): Promise<BankStatement[]> {
    const { churchId, bank, status, month, year, dateFrom, dateTo } = params
    const collection = await this.collection()

    const filters: Record<string, unknown> = {
      churchId,
    }

    if (bank) {
      filters.bank = bank
    }

    if (status) {
      filters.reconciliationStatus = status
    }

    if (month !== undefined) {
      filters.month = month
    }

    if (year !== undefined) {
      filters.year = year
    }

    if (dateFrom || dateTo) {
      const postedAtFilter: Record<string, Date> = {}

      if (dateFrom) {
        postedAtFilter.$gte = dateFrom
      }

      if (dateTo) {
        postedAtFilter.$lte = dateTo
      }

      filters.postedAt = postedAtFilter
    }

    const cursor = collection.find(filters).sort({ postedAt: -1 })
    const documents = await cursor.toArray()

    return documents.map((doc) => BankStatement.fromPrimitives(doc as any))
  }
}
