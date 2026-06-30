import {
  MemberContributionType,
  OnlineContributionsStatus,
} from "@/Financial/domain"

export type ContributionRequest = {
  amount: number
  bankTransferReceipt: any
  financialConceptId?: string
  contributionType: MemberContributionType
  paidAt: string
  observation?: string
}

export type ContributionChangeStatusRequest = {
  contributionId: string
  status: OnlineContributionsStatus
  availabilityAccountId: string
}
