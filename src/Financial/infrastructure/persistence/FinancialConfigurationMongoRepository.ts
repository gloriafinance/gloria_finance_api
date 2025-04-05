import { MongoRepository } from "@/Shared/infrastructure"
import { Bank, CostCenter, FinancialConcept } from "../../domain"
import { IFinancialConfigurationRepository } from "../../domain/interfaces"

export class FinancialConfigurationMongoRepository
  extends MongoRepository<any>
  implements IFinancialConfigurationRepository
{
  private static instance: FinancialConfigurationMongoRepository

  constructor() {
    super()
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

  async searchBanksByChurchId(churchId: string): Promise<Bank[]> {
    const collection = await this.collection<{
      banks: Bank[]
      churchId: string
    }>()

    const result = await collection.findOne(
      {
        churchId,
      },
      {
        projection: {
          _id: 1,
          churchId: 1,
          banks: 1,
        },
      }
    )

    if (!("banks" in result)) {
      return []
    }

    return result.banks.map((bank: any) =>
      Bank.fromPrimitives({
        id: result._id.toString(),
        churchId: result.churchId,
        ...bank,
      })
    )
  }

  async upsertBank(bank: Bank): Promise<void> {
    const collection = await this.collection()

    await collection.updateOne(
      { churchId: bank.getChurchId() },
      { $pull: { banks: { bankId: bank.getBankId() } } }
    )

    await collection.updateOne(
      { churchId: bank.getChurchId() },
      { $push: { banks: bank.toPrimitives() } },
      { upsert: true }
    )
  }

  async upsertFinancialConcept(concept: FinancialConcept): Promise<void> {
    const collection = await this.collection()
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
    const collection = await this.collection()

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
  ): Promise<CostCenter> {
    const collection = await this.collection<{
      costCenters: CostCenter[]
      churchId: string
    }>()
    const result = await collection.findOne(
      { "costCenters.costCenterId": costCenterId, churchId },
      { projection: { _id: 1, churchId: 1, costCenters: 1 } }
    )

    if (!result) {
      return undefined
    }

    return CostCenter.fromPrimitives({
      churchId: result.churchId,
      ...result.costCenters[0],
    })
  }

  async findBankByBankId(bankId: string): Promise<Bank> {
    const collection = await this.collection<{
      banks: Bank[]
      churchId: string
    }>()

    const result = await collection.findOne(
      { "banks.bankId": bankId },
      { projection: { _id: 1, churchId: 1, "banks.$": 1 } }
    )

    if (!result) {
      return undefined
    }

    return Bank.fromPrimitives({
      id: result._id.toString(),
      churchId: result.churchId,
      ...result.banks[0],
    })
  }

  async searchCenterCostsByChurchId(churchId: string): Promise<CostCenter[]> {
    const collection = await this.collection<{
      costCenters: { bankId }[]
    }>()
    const result = await collection.findOne(
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
