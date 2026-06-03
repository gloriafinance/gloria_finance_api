import { Logger } from "@/Shared/adapter"
import { type IStorageService } from "@/Shared/domain"
import { StorageProviderService } from "@/Shared/infrastructure/services/StorageProvider.service"
import { MemberNotFound } from "../../domain/exceptions/MemberNotFound.exception"
import { InvalidMemberStatus } from "../../domain/exceptions/InvalidMemberStatus.exception"
import { MemberStatus } from "../../domain/enums/MemberStatus.enum"

type MemberRepository = {
  one(criteria: Record<string, unknown>): Promise<any>
  upsert(member: any): Promise<void>
}

export type UpdateMemberProfilePhotoRequest = {
  churchId: string
  memberId: string
  profilePhoto: any
}

export type UpdateMemberProfilePhotoResult = {
  profilePhoto: string
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
    const uploadedPath = await this.storage.uploadFile(request.profilePhoto)

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

    const profilePhoto = await this.storage.downloadFile(uploadedPath)

    return {
      profilePhoto,
    }
  }

  private canUpdate(member: { getStatus(): MemberStatus }): boolean {
    const status = member.getStatus()
    return status === MemberStatus.APPROVED || status === MemberStatus.INACTIVE
  }
}
