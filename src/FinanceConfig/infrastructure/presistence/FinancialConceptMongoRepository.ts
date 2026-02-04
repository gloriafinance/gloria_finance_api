import { MongoRepository } from "@abejarano/ts-mongodb-criteria"
import {
  FinancialConcept,
  type IFinancialConceptRepository,
} from "@/FinanceConfig/domain"
import { Collection } from "mongodb"

export class FinancialConceptMongoRepository
  extends MongoRepository<FinancialConcept>
  implements IFinancialConceptRepository
{
  private static instance: FinancialConceptMongoRepository

  private constructor() {
    super(FinancialConcept)
  }

  static getInstance(): FinancialConceptMongoRepository {
    if (!FinancialConceptMongoRepository.instance) {
      FinancialConceptMongoRepository.instance =
        new FinancialConceptMongoRepository()
    }
    return FinancialConceptMongoRepository.instance
  }

  collectionName(): string {
    return "financial_concepts"
  }

  async search(filter: object): Promise<FinancialConcept[]> {
    const collection = await this.collection()
    const result = await collection.find(filter).sort({ name: 1 }).toArray()

    return result.map((concept) =>
      FinancialConcept.fromPrimitives({
        ...concept,
        id: concept._id,
      })
    )
  }

  protected ensureIndexes(collection: Collection): Promise<void> {
    return Promise.resolve(undefined)
  }
}
