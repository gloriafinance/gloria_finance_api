import { AssetModel } from "@/Patrimony/domain"
import { StorageGCP } from "@/Shared/infrastructure"

export const mapAssetToResponse = async (
  assets: AssetModel[]
): Promise<AssetModel[]> => {
  const storage: StorageGCP = StorageGCP.getInstance(process.env.BUCKET_FILES)

  let results = []

  for (const asset of assets) {
    let attachments = asset.attachments || []

    if (attachments.length > 0) {
      const attachmentPromises = attachments.map(async (a) => {
        return {
          ...a,
          url: await storage.downloadFile(a.url),
        }
      })

      attachments = await Promise.all(attachmentPromises)
    }

    results.push({
      ...asset,
      responsibleId: asset.responsibleId,
      attachments,
      documentsPending: attachments.length === 0,
    })
  }

  return results
}
