import { FinancialMonth, IFinancialYearRepository } from "../../domain"
import {
  Criteria,
  MongoRepository,
  Paginate,
} from "@abejarano/ts-mongodb-criteria"

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

  async one(filter: object): Promise<FinancialMonth | undefined> {
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

  list(criteria: Criteria): Promise<Paginate<FinancialMonth>>
  list(filter: object): Promise<FinancialMonth[]>

  override async list(
    filter: Criteria | object
  ): Promise<FinancialMonth[] | Paginate<FinancialMonth>> {
    const collection = await this.collection()
    const results = await collection.find(filter).sort({ month: 1 }).toArray()

    return results.map((result) =>
      FinancialMonth.fromPrimitives({
        id: result._id.toString(),
        ...result,
      })
    )
  }
}
