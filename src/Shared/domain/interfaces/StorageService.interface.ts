import type { Readable } from "node:stream"

export interface IStorageService {
  uploadFile(file: any): Promise<string>

  downloadFile(fileName: string): Promise<string>

  deleteFile(path: string): Promise<void>

  uploadOptimizedProfilePhoto(
    source: Readable,
    expectedMimeType: string
  ): Promise<string>

  promoteProfilePhoto(stagedPath: string): Promise<string>

  setBucketName(bucketName: string): IStorageService
}
