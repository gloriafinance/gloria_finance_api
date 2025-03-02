import { Criteria, Paginate } from "src/Shared/domain"
import { OnlineContributions } from "../../domain"
import { MongoRepository } from "../../../Shared/infrastructure"
import { IOnlineContributionsRepository } from "../../domain/interfaces"

export class OnlineContributionsMongoRepository
  extends MongoRepository<OnlineContributions>
  implements IOnlineContributionsRepository
{
  private static instance: OnlineContributionsMongoRepository

  constructor() {
    super()
  }

  static getInstance(): OnlineContributionsMongoRepository {
    if (!OnlineContributionsMongoRepository.instance) {
      OnlineContributionsMongoRepository.instance =
        new OnlineContributionsMongoRepository()
    }
    return OnlineContributionsMongoRepository.instance
  }

  collectionName(): string {
    return "contributions"
  }

  async upsert(contribution: OnlineContributions): Promise<void> {
    await this.persist(contribution.getId(), contribution)
  }

  async findByCriteria(
    criteria: Criteria
  ): Promise<Paginate<OnlineContributions>> {
    const documents = await this.searchByCriteria<OnlineContributions>(criteria)
    return this.buildPaginate<OnlineContributions>(documents)
  }

  async findByMemberId(
    memberId: string
  ): Promise<Paginate<OnlineContributions>> {
    throw new Error("Method not implemented.")
  }

  async findById(
    contributionId: string
  ): Promise<OnlineContributions | undefined> {
    const collection = await this.collection()
    const result = await collection.findOne({ contributionId })

    if (!result) {
      return undefined
    }

    return OnlineContributions.fromPrimitives({
      id: result._id.toString(),
      ...result,
    })
  }
}
