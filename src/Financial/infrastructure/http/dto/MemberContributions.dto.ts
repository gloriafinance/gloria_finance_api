import { Paginate } from "../../../../Shared/domain"
import { StorageGCP } from "../../../../Shared/infrastructure"

export default async (list: Paginate<any>) => {
  const storage: StorageGCP = StorageGCP.getInstance(process.env.BUCKET_FILES)
  let results = []

  for (const item of list.results) {
    results.push({
      contributionId: item.contributionId,
      amount: item.amount,
      status: item.status,
      createdAt: item.createdAt,
      bankTransferReceipt: await storage.downloadFile(item.bankTransferReceipt),
      bankId: item.bankId,
      type: item.type,
      availabilityAccount: {
        accountName: item.availabilityAccount.accountName,
        symbol: item.availabilityAccount.symbol,
      },
      member: {
        memberId: item.member.memberId,
        name: item.member.name,
        churchId: item.member.churchId,
      },
      financeConcept: {
        financialConceptId: item.financialConcept.financialConceptId,
        name: item.financialConcept.name,
      },
    })
  }

  return {
    count: list.count,
    nextPag: list.nextPag,
    results,
  }
}
