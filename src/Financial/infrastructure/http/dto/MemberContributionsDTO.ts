import type { Paginate } from "@abejarano/ts-mongodb-criteria"
import type { IStorageService } from "@/Shared/domain"

export const MemberContributionsDTO = async (params: {
  item: any
  symbol: string
  storage?: IStorageService
}) => {
  const { item, symbol, storage } = params

  const bankTransferReceipt = storage
    ? await storage.downloadFile(item.bankTransferReceipt)
    : ""

  return {
    contributionId: item.contributionId,
    amount: item.amount,
    status: item.status,
    createdAt: item.createdAt,
    bankTransferReceipt,
    bankId: item.bankId,
    type: item.type,
    availabilityAccount: item.availabilityAccount
      ? {
          accountName: item.availabilityAccount.accountName,
          symbol: item.availabilityAccount.symbol ?? symbol,
        }
      : { symbol },
    member: {
      memberId: item.member.memberId,
      name: item.member.name,
      churchId: item.member.churchId,
    },
    financeConcept: {
      financialConceptId: item.financialConcept.financialConceptId,
      name: item.financialConcept.name,
    },
  }
}

export const MemberContributionPaginateDTO = async (
  list: Paginate<any>,
  symbol: string
) => {
  let results = []

  for (const item of list.results) {
    results.push(await MemberContributionsDTO({ item, symbol }))
  }

  return {
    count: list.count,
    nextPag: list.nextPag,
    results,
  }
}
