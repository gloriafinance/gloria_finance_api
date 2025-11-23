import { StorageGCP } from "@/Shared/infrastructure"
import { ConceptType } from "../../../domain"
import { Paginate } from "@abejarano/ts-mongodb-criteria"

export default async (list: Paginate<any>) => {
  const storage: StorageGCP = StorageGCP.getInstance(process.env.BUCKET_FILES)
  let results = []

  for (const item of list.results) {
    if (item.voucher) {
      item.voucher = await storage.downloadFile(item.voucher)
    }

    const object = {
      financialConcept: item.financialConcept,
      financialRecordId: item.financialRecordId,
      churchId: item.churchId,
      amount: item.amount,
      date: item.date,
      type: item.type,
      voucher: item.voucher,
      availabilityAccount: item.availabilityAccount,
      description: item.description,
      status: item.status,
    }

    if (item.type === ConceptType.OUTGO) {
      object["costCenter"] = item.costCenter
    }

    results.push(object)
  }

  return {
    count: list.count,
    nextPag: list.nextPag,
    results,
  }
}
