import { MongoRepository } from "@abejarano/ts-mongodb-criteria"
import { OnlineContributions } from "../../domain"
import { IOnlineContributionsRepository } from "../../domain/interfaces"

export class OnlineContributionsMongoRepository
  extends MongoRepository<OnlineContributions>
  implements IOnlineContributionsRepository
{
  private static instance: OnlineContributionsMongoRepository

  private constructor() {
    super(OnlineContributions)
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
