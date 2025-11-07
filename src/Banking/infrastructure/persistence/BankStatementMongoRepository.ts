import { Logger } from "@/Shared/adapter/CustomLogger"
import {
  BankStatement,
  BankStatementStatus,
  IBankStatementRepository,
} from "@/Banking/domain"
import {
  Criteria,
  MongoRepository,
  Paginate,
} from "@abejarano/ts-mongodb-criteria"

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
        this.logger.info("Duplicate bank statements ignored during bulk insert")
        return
      }

      throw error
    }
  }

  async one(filter: object): Promise<BankStatement | undefined> {
    const collection = await this.collection()
    const result = await collection.findOne(filter)

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

  async list(criteria: Criteria): Promise<Paginate<BankStatement>> {
    const documents = await this.searchByCriteria<any>(criteria)
    const pagination = await this.paginate(documents)

    return {
      ...pagination,
      results: pagination.results.map((doc) =>
        BankStatement.fromPrimitives({ ...doc, id: doc._id })
      ),
    }
  }
}
