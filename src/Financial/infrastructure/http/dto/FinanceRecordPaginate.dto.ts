import { ConceptType } from "../../../domain"
import type { Paginate } from "@abejarano/ts-mongodb-criteria"
import type { IStorageService } from "@/Shared/domain"

export const FinanceRecordDTO = async (
  item: any,
  storage?: IStorageService
) => {
  const object: any = {
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
    reference: item.reference,
  }

  if (item.type === ConceptType.OUTGO) {
    object["costCenter"] = item.costCenter
  }

  if (item.voucher && storage) {
    object.voucher = await storage.downloadFile(item.voucher)
  }

  return object
}

export const FinanceRecordPaginateDTO = async (list: Paginate<any>) => {
  let results = []

  for (const item of list.results) {
    results.push(await FinanceRecordDTO(item))
  }

  return {
    count: list.count,
    nextPag: list.nextPag,
    results,
  }
}
