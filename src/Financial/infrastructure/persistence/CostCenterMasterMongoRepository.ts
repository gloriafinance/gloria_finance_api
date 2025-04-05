import { MongoRepository } from "@/Shared/infrastructure"
import { CostCenterMaster } from "../../domain"
import { ICostCenterMasterRepository } from "../../domain/interfaces"

export class CostCenterMasterMongoRepository
  extends MongoRepository<CostCenterMaster>
  implements ICostCenterMasterRepository
{
  private static instance: CostCenterMasterMongoRepository

  static getInstance(): CostCenterMasterMongoRepository {
    if (!this.instance) {
      this.instance = new CostCenterMasterMongoRepository()
    }

    return this.instance
  }

  collectionName(): string {
    return "cost_centers_master"
  }

  async one(costCenterMasterId: string): Promise<CostCenterMaster | undefined> {
    const collection = await this.collection()
    const document = await collection.findOne({
      costCenterMasterId,
    })

    return document
      ? CostCenterMaster.fromPrimitives({
          ...document,
          id: document._id,
        })
      : undefined
  }

  async search(
    churchId: string,
    month: number,
    year: number
  ): Promise<CostCenterMaster[]> {
    const collection = await this.collection()
    const documents = await collection
      .find({
        churchId,
        month,
        year,
      })
      .toArray()

    return documents.map((document) =>
      CostCenterMaster.fromPrimitives({
        ...document,
        id: document._id,
      })
    )
  }

  async upsert(costCenterMaster: CostCenterMaster): Promise<void> {
    await this.persist(costCenterMaster.getId(), costCenterMaster)
  }
}
