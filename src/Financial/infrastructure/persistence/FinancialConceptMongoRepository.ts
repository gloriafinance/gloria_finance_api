import { MongoRepository } from "@/Shared/infrastructure"
import { ConceptType, FinancialConcept } from "../../domain"
import { IFinancialConceptRepository } from "../../domain/interfaces"

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

  async findFinancialConceptByChurchIdAndFinancialConceptId(
    churchId: string,
    financialConceptId: string
  ): Promise<FinancialConcept | undefined> {
    const collection = await this.collection()
    const result = await collection.findOne({
      churchId,
      financialConceptId,
    })

    if (!result) {
      return undefined
    }

    return FinancialConcept.fromPrimitives({
      ...result,
      id: result._id,
    })
  }

  async findFinancialConceptsByChurchId(
    churchId: string
  ): Promise<FinancialConcept[]> {
    const collection = await this.collection()
    const result = await collection.find({ churchId }).toArray()

    return result.map((concept) =>
      FinancialConcept.fromPrimitives({
        ...concept,
        id: concept._id,
      })
    )
  }

  async findFinancialConceptsByChurchIdAndTypeConcept(
    churchId: string,
    typeConcept: ConceptType
  ): Promise<FinancialConcept[]> {
    const collection = await this.collection()
    const result = await collection
      .find({ churchId, type: typeConcept })
      .toArray()

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

  async one(params: Object): Promise<FinancialConcept | undefined> {
    const collection = await this.collection()
    const document = await collection.findOne(params)

    if (!document) {
      return undefined
    }

    return FinancialConcept.fromPrimitives({
      ...document,
      id: document._id,
    })
  }
}
