import { Logger } from "@/Shared/adapter"
import { type IStorageService } from "@/Shared/domain"
import { StorageProviderService } from "@/Shared/infrastructure/services/StorageProvider.service"
import {
  InvalidMemberStatus,
  MemberNotFound,
  MemberStatus,
} from "@/Church/domain"

type MemberRepository = {
  one(criteria: Record<string, unknown>): Promise<any>
  upsert(member: any): Promise<void>
}

export type UpdateMemberProfilePhotoRequest = {
  churchId: string
  memberId: string
  stagedProfilePhotoPath: string
}

export type UpdateMemberProfilePhotoResult = {
  profilePhoto: string
  profilePhotoUrl: string
}

export class UpdateMemberProfilePhoto {
  private readonly logger = Logger(UpdateMemberProfilePhoto.name)

  constructor(
    private readonly memberRepository: MemberRepository,
    private readonly storage: IStorageService = StorageProviderService.getInstance()
  ) {}

  async execute(
    request: UpdateMemberProfilePhotoRequest
  ): Promise<UpdateMemberProfilePhotoResult> {
    if (!request.memberId || !request.churchId) {
      throw new MemberNotFound()
    }

    const member = await this.memberRepository.one({
      memberId: request.memberId,
      "church.churchId": request.churchId,
    })

    if (!member) {
      throw new MemberNotFound()
    }

    if (!this.canUpdate(member)) {
      throw new InvalidMemberStatus()
    }

    const previousPhotoPath = member.getProfilePhoto()
    const uploadedPath = await this.storage.promoteProfilePhoto(
      request.stagedProfilePhotoPath
    )

    try {
      member.setProfilePhoto(uploadedPath)
      await this.memberRepository.upsert(member)
    } catch (error) {
      await this.storage.deleteFile(uploadedPath).catch(() => undefined)
      throw error
    }

    if (previousPhotoPath && previousPhotoPath !== uploadedPath) {
      await this.storage.deleteFile(previousPhotoPath).catch((error: any) => {
        this.logger.error("Unable to delete previous member profile photo", {
          memberId: request.memberId,
          previousPhotoPath,
          message: error?.message ?? "Unknown error",
        })
      })
    }

    const profilePhotoUrl = await this.storage.downloadFile(uploadedPath)

    return {
      profilePhoto: uploadedPath,
      profilePhotoUrl,
    }
  }

  private canUpdate(member: { getStatus(): MemberStatus }): boolean {
    const status = member.getStatus()
    return status === MemberStatus.APPROVED || status === MemberStatus.INACTIVE
  }
}
