import { GenericException, type IStorageService } from "@/Shared/domain"
import { StorageGCP } from "@/package/gcp"

export class StorageProviderService {
  private static instance: IStorageService

  static getInstance(bucketName?: string): IStorageService {
    const cloudProvider = (process.env.CLOUD_PROVIDER ?? "gcp").toLowerCase()
    if (cloudProvider !== "gcp") {
      throw new GenericException(
        `Unsupported CLOUD_PROVIDER '${cloudProvider}' for Storage`
      )
    }

    const resolvedBucketName = this.resolveBucketName(bucketName)

    if (!StorageProviderService.instance) {
      StorageProviderService.instance =
        StorageGCP.getInstance(resolvedBucketName)
      return StorageProviderService.instance
    }

    StorageProviderService.instance.setBucketName(resolvedBucketName)
    return StorageProviderService.instance
  }

  private static resolveBucketName(bucketName?: string): string {
    const resolvedBucketName = (
      bucketName ||
      process.env.BUCKET_FILES ||
      ""
    ).trim()
    if (!resolvedBucketName) {
      throw new GenericException(
        "BUCKET_FILES is required to resolve storage implementation"
      )
    }
    return resolvedBucketName
  }
}
