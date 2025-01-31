import { MongoRepository } from "../../../Shared/infrastructure"
import { FinancialMonth, IFinancialYearRepository } from "../../domain"

export class FinancialYearMongoRepository
  extends MongoRepository<FinancialMonth>
  implements IFinancialYearRepository
{
  private static instance: FinancialYearMongoRepository

  constructor() {
    super()
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

  async upsert(financialYear: FinancialMonth): Promise<void> {
    await this.persist(financialYear.getId(), financialYear)
  }

  async one(filter: Object): Promise<FinancialMonth | undefined> {
    const collection = await this.collection()
    const result = await collection.findOne(filter)

    if (!result) {
      return undefined
    }

    return FinancialMonth.fromPrimitives({
      id: result._id.toString(),
      ...result,
    })
  }
}
