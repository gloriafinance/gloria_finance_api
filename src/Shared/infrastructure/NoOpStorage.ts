import { IStorageService } from "@/Shared/domain"

/**
 * NoOpStorage
 *
 * @description Implements the storage interface without performing side
 * effects. Useful when a storage dependency is required but the operation
 * should stay in-memory or local to the process (e.g. returning PDFs directly
 * to the client).
 */
export class NoOpStorage implements IStorageService {
  private static instance: NoOpStorage

  static getInstance(): NoOpStorage {
    if (!NoOpStorage.instance) {
      NoOpStorage.instance = new NoOpStorage()
    }
    return NoOpStorage.instance
  }

  async uploadFile(): Promise<string> {
    throw new Error(
      "Upload not supported in NoOpStorage. NoOpStorage is intended for operations that do not require cloud storage. If you need to upload files to cloud storage, please use an appropriate storage implementation."
    )
  }

  async downloadFile(): Promise<string> {
    throw new Error(
      "Download not supported in NoOpStorage. NoOpStorage is intended for operations that do not require cloud storage. If you need to download files from cloud storage, please use an appropriate storage implementation."
    )
  }

  async deleteFile(): Promise<void> {
    // Nothing to remove
  }

  setBucketName(): IStorageService {
    return this
  }
}
