import { MemberContributionType } from "@/Financial/domain"

export type ContributionRequest = {
  amount: number
  bankTransferReceipt: any
  financialConceptId?: string
  contributionType: MemberContributionType
  availabilityAccountId: string
  paidAt: string
  observation?: string
}
