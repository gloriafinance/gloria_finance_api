import { MongoRepository } from "@abejarano/ts-mongodb-criteria"
import {
  CostCenter,
  FinancialConcept,
  IFinancialConfigurationRepository,
} from "@/FinanceConfig/domain"

export class FinancialConfigurationMongoRepository
  extends MongoRepository<FinancialConcept>
  implements IFinancialConfigurationRepository
{
  private static instance: FinancialConfigurationMongoRepository

  constructor() {
    super(FinancialConcept)
  }

  static getInstance(): FinancialConfigurationMongoRepository {
    if (!FinancialConfigurationMongoRepository.instance) {
      FinancialConfigurationMongoRepository.instance =
        new FinancialConfigurationMongoRepository()
    }
    return FinancialConfigurationMongoRepository.instance
  }

  collectionName(): string {
    return "churches"
  }

  async upsertFinancialConcept(concept: FinancialConcept): Promise<void> {
    const collection = await this.collection<FinancialConcept>()

    await collection.updateOne(
      { churchId: concept.getChurchId() },
      {
        $pull: {
          financialConcepts: {
            financialConceptId: concept.getFinancialConceptId(),
          },
        },
      }
    )

    await collection.updateOne(
      { churchId: concept.getChurchId() },
      { $push: { financialConcepts: concept.toPrimitives() } },
      { upsert: true }
    )
  }

  async upsertCostCenter(costCenter: CostCenter): Promise<void> {
    const collection = await this.collection<FinancialConcept>()

    await collection.updateOne(
      {
        churchId: costCenter.getChurchId(),
      },
      {
        $pull: {
          costCenters: { costCenterId: costCenter.getCostCenterId() },
        },
      }
    )

    await collection.updateOne(
      {
        churchId: costCenter.getChurchId(),
      },
      { $push: { costCenters: costCenter.toPrimitives() } },
      { upsert: true }
    )
  }

  async findCostCenterByCostCenterId(
    costCenterId: string,
    churchId: string
  ): Promise<CostCenter | undefined> {
    /*const collection = await this.collection<{
      costCenters: CostCenter[]
      churchId: string
    }>()*/
    const collection = await this.collection()

    const result = await collection.findOne<any>(
      { "costCenters.costCenterId": costCenterId, churchId },
      { projection: { _id: 1, churchId: 1, "costCenters.$": 1 } }
    )

    if (!result) {
      return undefined
    }

    return CostCenter.fromPrimitives({
      churchId: result.churchId,
      ...result.costCenters[0],
    })
  }

  async searchCenterCostsByChurchId(churchId: string): Promise<CostCenter[]> {
    /*const collection = await this.collection<{
      costCenters: { bankId }[]
    }>()*/

    const collection = await this.collection()

    const result = await collection.findOne<any>(
      { churchId },
      { projection: { _id: 1, costCenters: 1 } }
    )

    if (!result || !result.costCenters) {
      return []
    }

    const listCostCenter: CostCenter[] = []

    for (const costCenter of result.costCenters) {
      listCostCenter.push(
        CostCenter.fromPrimitives({
          id: result._id.toString(),
          ...costCenter,
        })
      )
    }
    return listCostCenter
  }
}
