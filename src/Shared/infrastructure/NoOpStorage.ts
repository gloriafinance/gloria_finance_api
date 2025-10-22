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
    throw new Error("Upload not supported in NoOpStorage")
  }

  async downloadFile(): Promise<string> {
    throw new Error("Download not supported in NoOpStorage")
  }

  async deleteFile(): Promise<void> {
    // Nothing to remove
  }

  setBucketName(): IStorageService {
    return this
  }
}
