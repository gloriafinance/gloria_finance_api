import { OnlineContributions } from "@/Financial/domain"
import { OnlineContributionsStatus } from "@/Financial/domain/enums/OnlineContributionsStatus.enum"
import { IRepository } from "@abejarano/ts-mongodb-criteria"

export interface IOnlineContributionsRepository extends IRepository<OnlineContributions> {
  findById(contributionId: string): Promise<OnlineContributions | undefined>

  sumByMemberAndPaidAtRanges(params: {
    memberId: string
    churchId: string
    statuses: OnlineContributionsStatus[]
    yearRange: { start: Date; end: Date }
    monthRange: { start: Date; end: Date }
  }): Promise<{ contributedYear: number; contributedMonth: number }>
}
