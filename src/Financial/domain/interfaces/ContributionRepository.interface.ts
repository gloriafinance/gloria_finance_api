import { OnlineContributions } from "../OnlineContributions"
import { Criteria, Paginate } from "@abejarano/ts-mongodb-criteria"

export interface IOnlineContributionsRepository {
  findById(contributionId: string): Promise<OnlineContributions | undefined>

  upsert(contribution: OnlineContributions): Promise<void>

  findByCriteria(criteria: Criteria): Promise<Paginate<OnlineContributions>>

  findByMemberId(memberId: string): Promise<Paginate<OnlineContributions>>
}
