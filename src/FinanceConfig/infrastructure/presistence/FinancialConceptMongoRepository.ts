import { MongoRepository } from "@abejarano/ts-mongodb-criteria"
import {
  FinancialConcept,
  IFinancialConceptRepository,
} from "@/FinanceConfig/domain"

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

  async listByCriteria(filter: object): Promise<FinancialConcept[]> {
    const collection = await this.collection()
    const result = await collection.find(filter).sort({ name: 1 }).toArray()

    return result.map((concept) =>
      FinancialConcept.fromPrimitives({
        ...concept,
        id: concept._id,
      })
    )
  }
}
