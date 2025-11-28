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

  async one(filter: object): Promise<FinancialConcept | undefined> {
    const collection = await this.collection()
    const result = await collection.findOne(filter)

    if (!result) {
      return undefined
    }

    return FinancialConcept.fromPrimitives({
      ...result,
      id: result._id,
    })
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

  async upsert(financialConcept: FinancialConcept): Promise<void> {
    await this.persist(financialConcept.getId(), financialConcept)
  }
}
