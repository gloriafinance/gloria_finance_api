import { MongoRepository } from "@abejarano/ts-mongodb-criteria"
import { OnlineContributions } from "../../domain"
import { OnlineContributionsStatus } from "@/Financial/domain"
import type { IOnlineContributionsRepository } from "../../domain/interfaces"
import { Collection } from "mongodb"

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

  async sumByMemberAndPaidAtRanges(params: {
    memberId: string
    churchId: string
    statuses: OnlineContributionsStatus[]
    yearRange: { start: Date; end: Date }
    monthRange: { start: Date; end: Date }
  }): Promise<{ contributedYear: number; contributedMonth: number }> {
    const { memberId, churchId, statuses, yearRange, monthRange } = params
    const collection = await this.collection()

    const matchFilter: Record<string, unknown> = {
      churchId,
      "member.memberId": memberId,
      paidAt: { $gte: yearRange.start, $lte: yearRange.end },
    }

    if (statuses?.length) {
      matchFilter.status =
        statuses.length === 1 ? statuses[0] : { $in: statuses }
    }

    const result = await collection
      .aggregate([
        { $match: matchFilter },
        {
          $group: {
            _id: null,
            contributedYear: { $sum: "$amount" },
            contributedMonth: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $gte: ["$paidAt", monthRange.start] },
                      { $lte: ["$paidAt", monthRange.end] },
                    ],
                  },
                  "$amount",
                  0,
                ],
              },
            },
          },
        },
        {
          $project: {
            _id: 0,
            contributedYear: 1,
            contributedMonth: 1,
          },
        },
      ])
      .toArray()

    if (!result?.length) {
      return { contributedYear: 0, contributedMonth: 0 }
    }

    return {
      contributedYear: Number(result[0]!.contributedYear ?? 0),
      contributedMonth: Number(result[0]!.contributedMonth ?? 0),
    }
  }

  protected ensureIndexes(collection: Collection): Promise<void> {
    return Promise.all([
      collection.createIndex(
        {
          churchId: 1,
          "member.memberId": 1,
          status: 1,
          paidAt: 1,
        },
        { background: true, name: "idx_contribution_member_paid_status" }
      ),
    ]).then(() => undefined)
  }
}
