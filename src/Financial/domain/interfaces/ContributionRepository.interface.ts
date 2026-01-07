import { OnlineContributions } from "@/Financial/domain"
import { IRepository } from "@abejarano/ts-mongodb-criteria"

export interface IOnlineContributionsRepository extends IRepository<OnlineContributions> {
  findById(contributionId: string): Promise<OnlineContributions | undefined>
}
