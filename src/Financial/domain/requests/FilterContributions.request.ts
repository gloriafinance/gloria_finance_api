import { OnlineContributionsStatus } from "../enums/OnlineContributionsStatus.enum"

export type FilterContributionsRequest = {
  financialConceptId: string
  status: OnlineContributionsStatus
  memberId: string
  churchId: string
  startDate: string
  endDate: string
  page: number
  perPage: number
}
