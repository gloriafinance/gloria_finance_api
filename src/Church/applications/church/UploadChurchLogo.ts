import { ChurchNotFound, type IChurchRepository } from "@/Church/domain"
import { Logger } from "@/Shared/adapter"
import { type IStorageService } from "@/Shared/domain"
import { StorageProviderService } from "@/Shared/infrastructure"

export class UploadChurchLogo {
  private readonly logger = Logger(UploadChurchLogo.name)

  constructor(
    private readonly churchRepository: IChurchRepository,
    private readonly storage: IStorageService = StorageProviderService.getInstance()
  ) {}

  async execute(
    churchId: string,
    file: any
  ): Promise<{ path: string; url: string }> {
    const church = await this.churchRepository.one({ churchId })
    if (!church) {
      throw new ChurchNotFound()
    }

    const previousLogoPath = church.getLogoUrl()
    const uploadedPath = await this.storage.uploadFile(file)

    try {
      church.setLogoUrl(uploadedPath)
      await this.churchRepository.upsert(church)
    } catch (error) {
      await this.storage.deleteFile(uploadedPath).catch(() => undefined)
      throw error
    }

    if (previousLogoPath && previousLogoPath !== uploadedPath) {
      await this.storage.deleteFile(previousLogoPath).catch((error: any) => {
        this.logger.error("Unable to delete previous church logo", {
          churchId,
          previousLogoPath,
          message: error?.message ?? "Unknown error",
        })
      })
    }

    const url = await this.storage.downloadFile(uploadedPath)

    return {
      path: uploadedPath,
      url,
    }
  }
}
