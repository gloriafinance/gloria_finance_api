import { StorageProviderService } from "@/Shared/infrastructure"
import { Purchase } from "../../../domain/models"
import { Paginate } from "@abejarano/ts-mongodb-criteria"

export default async (list: Paginate<Purchase>) => {
  const storage = StorageProviderService.getInstance()
  let results = []

  for (const item of list.results) {
    item.invoice = await storage.downloadFile(item.invoice)

    const object = { ...item, invoice: item.invoice }

    delete object["_id"]

    results.push(object)
  }

  return {
    count: list.count,
    nextPag: list.nextPag,
    results,
  }
}
