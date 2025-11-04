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
      await collection.insertMany(documents, { ordered: false })
    } catch (error: unknown) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code: number }).code === 11000
      ) {
        this.logger.warn("Duplicate bank statements ignored during bulk insert")
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

  async findUnmatchedByPeriod(params: {
    churchId: string
    bank?: string
    month: number
    year: number
  }): Promise<BankStatement[]> {
    const { churchId, bank, month, year } = params
    const collection = await this.collection()

    const filters: Record<string, unknown> = {
      churchId,
      month,
      year,
      reconciliationStatus: { $in: [BankStatementStatus.PENDING, BankStatementStatus.UNMATCHED] },
    }

    if (bank) {
      filters.bank = bank
    }

    const cursor = collection.find(filters)
    const documents = await cursor.toArray()

    return documents.map((doc) => BankStatement.fromPrimitives(doc as any))
  }

  async updateStatus(
    statementId: string,
    status: BankStatementStatus,
    financialRecordId?: string
  ): Promise<void> {
    const collection = await this.collection()
    const update: Record<string, unknown> = {
      reconciliationStatus: status,
      updatedAt: new Date(),
    }

    if (financialRecordId) {
      update.financialRecordId = financialRecordId
      update.reconciledAt = new Date()
    }

    await collection.updateOne(
      { bankStatementId: statementId },
      {
        $set: update,
      }
    )
  }
}
