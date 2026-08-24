import { Storage } from "@google-cloud/storage"
import * as fs from "fs"
import { Readable } from "node:stream"
import { pipeline } from "node:stream/promises"
import sharp from "sharp"
import {
  GenericException,
  type ICacheService,
  type IStorageService,
} from "@/Shared/domain"
import { Logger } from "@/Shared/adapter"
import { CacheProviderService } from "@/Shared/infrastructure/services/CacheProvider.service"

export class StorageGCP implements IStorageService {
  private static _instance: StorageGCP
  private logger = Logger("StorageGCP")
  private storage: Storage
  private bucketName: string
  private cacheService: ICacheService = CacheProviderService.getInstance()
  private readonly downloadCacheTtlSeconds = 50 * 60

  constructor(bucketName?: string) {
    this.storage = new Storage()

    if (bucketName) {
      this.bucketName = bucketName
    }

    //this.configureBucketCors(bucketName).catch(console.error);
  }

  static getInstance(bucketName: string): StorageGCP {
    if (!StorageGCP._instance) {
      StorageGCP._instance = new StorageGCP(bucketName)
    }
    return StorageGCP._instance
  }

  // async configureBucketCors(bucketName: string) {
  //   await this.storage.bucket(bucketName).setCorsConfiguration([
  //     {
  //       origin: ["*"],
  //       responseHeader: ["Content-Type"],
  //       method: ["GET"],
  //       maxAgeSeconds: 3600,
  //     },
  //   ]);
  // }

  setBucketName(bucketName: string): IStorageService {
    this.bucketName = bucketName
    return this
  }

  /**
   * Return a signed URL for downloading a file
   * @param pathInFileStorage
   */
  async downloadFile(pathInFileStorage: string): Promise<string> {
    try {
      const cacheKey = `storage:download:${this.bucketName}:${pathInFileStorage}`
      const cachedUrl = await this.cacheService.get<string>(cacheKey)

      if (cachedUrl) {
        return cachedUrl
      }

      const bucket = this.storage.bucket(this.bucketName)
      const file = bucket.file(pathInFileStorage)

      // Generate signed URL with expiration (1 hour)
      const [url] = await file.getSignedUrl({
        action: "read",
        expires: Date.now() + 3600 * 1000,
      })

      await this.cacheService.set(cacheKey, url, this.downloadCacheTtlSeconds)
      return url
    } catch (error: any) {
      this.logger.error("Error generating signed URL:", error)
      throw new GenericException("Error generating signed URL.")
    }
  }

  /**
   * Upload a file to GCP Storage
   * @param file File to upload
   */
  async uploadFile(file: any): Promise<string> {
    this.logger.info("Uploading file to GCP Storage...", file)

    const key: string = this.generateNameFile(file)

    try {
      const bucket = this.storage.bucket(this.bucketName)
      const gcsFile = bucket.file(key)

      const tempFilePath = file?.tempFilePath || file?.path || file?.filePath

      await new Promise<void>((resolve, reject) => {
        const uploadStream = gcsFile.createWriteStream({
          metadata: {
            contentType: file?.mimetype || file?.type,
          },
        })

        const handleError = (err: any) => {
          this.logger.error("Error uploading file to GCP Storage:", err)
          reject(new GenericException("Error uploading file to GCP Storage."))
        }

        uploadStream.on("error", handleError).on("finish", () => {
          this.logger.info("File uploaded successfully to GCP Storage.")
          resolve()
        })

        if (tempFilePath) {
          fs.createReadStream(tempFilePath)
            .on("error", handleError)
            .pipe(uploadStream)
          return
        }

        if (file?.data && Buffer.isBuffer(file.data)) {
          Readable.from(file.data).pipe(uploadStream)
          return
        }

        // Bun File / Blob
        if (file?.arrayBuffer && typeof file.arrayBuffer === "function") {
          file
            .arrayBuffer()
            .then((ab: ArrayBuffer) => {
              Readable.from(Buffer.from(ab)).pipe(uploadStream)
            })
            .catch(handleError)
          return
        }

        handleError(
          new GenericException(
            "File must include a tempFilePath, path, data buffer, or arrayBuffer()."
          )
        )
      })

      if (tempFilePath) {
        fs.unlink(tempFilePath, (unlinkErr) => {
          if (unlinkErr) {
            this.logger.error("Error deleting temporary file:", unlinkErr)
          } else {
            this.logger.info("Temporary file deleted successfully.")
          }
        })
      }

      this.logger.info("File uploaded successfully to GCP Storage.")
      return key
    } catch (error: any) {
      this.logger.error("Error uploading file to GCP Storage:", error)
      throw new Error("Error uploading file to GCP Storage.")
    }
  }

  async uploadOptimizedProfilePhoto(
    source: Readable,
    expectedMimeType: string
  ): Promise<string> {
    const key = `profile-photos/staged/${crypto.randomUUID()}.webp`
    const bucket = this.storage.bucket(this.bucketName)
    const destination = bucket.file(key)
    const image = sharp({ limitInputPixels: 40_000_000, failOn: "error" })
    const metadataPromise = image.metadata()

    try {
      await pipeline(
        source,
        image
          .rotate()
          .resize({
            width: 1024,
            height: 1024,
            fit: "inside",
            withoutEnlargement: true,
          })
          .webp({ quality: 82 }),
        destination.createWriteStream({
          metadata: { contentType: "image/webp" },
        })
      )

      const metadata = await metadataPromise
      const mimeByFormat: Record<string, string> = {
        jpeg: "image/jpeg",
        png: "image/png",
        webp: "image/webp",
      }
      if (
        !metadata.format ||
        mimeByFormat[metadata.format] !== expectedMimeType
      ) {
        await destination.delete({ ignoreNotFound: true })
        throw new GenericException("Invalid profile photo content.")
      }

      return key
    } catch (error) {
      await destination.delete({ ignoreNotFound: true }).catch(() => undefined)
      throw error
    }
  }

  async promoteProfilePhoto(stagedPath: string): Promise<string> {
    if (!stagedPath.startsWith("profile-photos/staged/")) {
      throw new GenericException("Invalid staged profile photo path.")
    }

    const finalPath = `profile-photos/${crypto.randomUUID()}.webp`
    const bucket = this.storage.bucket(this.bucketName)
    const source = bucket.file(stagedPath)
    const destination = bucket.file(finalPath)

    await source.copy(destination)
    await source.delete({ ignoreNotFound: true })
    return finalPath
  }

  /**
   * Delete a file from GCP Storage
   * @param path File path in GCP Storage
   */
  async deleteFile(path: string) {
    try {
      const bucket = this.storage.bucket(this.bucketName)
      const file = bucket.file(path)

      await file.delete()
      this.logger.info(`File ${path} deleted successfully from GCP Storage.`)
    } catch (error: any) {
      this.logger.error("Error deleting file from GCP Storage:", error)
      throw new Error("Error deleting file from GCP Storage.")
    }
  }

  /**
   * Generate a unique file name
   * @param file
   */
  private generateNameFile(file: any): string {
    const currentDate: Date = new Date()
    const year: number = currentDate.getFullYear()
    const month: number = currentDate.getMonth() + 1

    const originalName = file?.name || file?.originalname || "file"
    const extension = originalName.includes(".")
      ? originalName.split(".").pop()
      : undefined
    const newFileName = extension
      ? `${crypto.randomUUID()}.${extension}`
      : crypto.randomUUID()

    return `${year}/${month}/${newFileName}`
  }
}
