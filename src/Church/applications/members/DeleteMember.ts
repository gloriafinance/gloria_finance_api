import {
  type IMemberRepository,
  MemberNotFound,
  MemberSelfDeletionNotAllowed,
} from "../../domain"
import { Logger } from "@/Shared/adapter"
import type { IStorageService } from "@/Shared/domain"
import type { IUserRepository } from "@/SecuritySystem/domain/interfaces/UserRepository.interface"
import type { IUserAssignmentRepository } from "@/SecuritySystem/domain/interfaces/rbac"
import { AuthorizationService } from "@/SecuritySystem/applications/rbac/AuthorizationService"

export class DeleteMember {
  private readonly logger = Logger(DeleteMember.name)

  constructor(
    private readonly memberRepository: IMemberRepository,
    private readonly userRepository: IUserRepository,
    private readonly userAssignmentRepository: IUserAssignmentRepository,
    private readonly storage: IStorageService,
    private readonly authorizationService: AuthorizationService
  ) {}

  async execute(params: {
    memberId: string
    churchId: string
    authenticatedUserId: string
  }): Promise<void> {
    const { memberId, churchId, authenticatedUserId } = params

    const member = await this.memberRepository.one({
      memberId,
      "church.churchId": churchId,
    })

    if (!member) {
      throw new MemberNotFound()
    }

    const linkedUser = await this.userRepository.findByMemberIdAndChurchId(
      memberId,
      churchId
    )

    if (linkedUser && linkedUser.getUserId() === authenticatedUserId) {
      throw new MemberSelfDeletionNotAllowed()
    }

    const profilePhoto = member.getProfilePhoto()
    if (profilePhoto) {
      await this.storage.deleteFile(profilePhoto).catch((error: any) => {
        this.logger.error("Unable to delete member profile photo", {
          memberId,
          profilePhoto,
          error: error?.message,
        })
      })
    }

    await this.memberRepository.deleteByMemberId(memberId)

    if (linkedUser) {
      const userId = linkedUser.getUserId()
      await this.userRepository.deleteByUserId(userId)
      await this.userAssignmentRepository.deleteByUser(churchId, userId)
      await this.authorizationService.invalidateUserCache(churchId, userId)
    }

    this.logger.info(`Member deleted: ${memberId}`)
  }
}
