import { FinancialMonth, type IFinancialYearRepository } from "../../domain"
import { MongoRepository } from "@abejarano/ts-mongodb-criteria"
import { Collection } from "mongodb"

export class FinancialYearMongoRepository
  extends MongoRepository<FinancialMonth>
  implements IFinancialYearRepository
{
  private static instance: FinancialYearMongoRepository

  constructor() {
    super(FinancialMonth)
  }

  static getInstance(): FinancialYearMongoRepository {
    if (FinancialYearMongoRepository.instance) {
      return FinancialYearMongoRepository.instance
    }
    FinancialYearMongoRepository.instance = new FinancialYearMongoRepository()
    return FinancialYearMongoRepository.instance
  }

  collectionName(): string {
    return "financial_months"
  }

  protected async ensureIndexes(collection: Collection): Promise<void> {
    await collection.createIndex({
      month: 1,
      year: 1,
      churchId: 1,
    })
  }
}
