import {
  type IChurchRepository,
  type IMemberRepository,
  Member,
  MemberAlreadyExists,
  MemberGender,
  MemberStatus,
  TokenNotFound,
} from "../../domain"
import type { IStorageService } from "@/Shared/domain"
import { StorageProviderService } from "@/Shared/infrastructure"
import { Logger } from "@/Shared/adapter"
import type { MemberAddress } from "../../domain/type/MemberAddress.type"

export type RegisterMemberByTokenRequest = {
  token: string
  fullName: string
  phone: string
  lgpdConsentAccepted: boolean
  stagedProfilePhotoPath: string
  email?: string
  dni?: string
  birthdate?: Date
  gender?: MemberGender
  address?: MemberAddress
}

export type RegisterMemberByTokenResult = {
  message: "MEMBER_REGISTRATION_RECEIVED"
}

export class RegisterMemberByToken {
  private logger = Logger(RegisterMemberByToken.name)

  constructor(
    private readonly memberRepository: IMemberRepository,
    private readonly churchRepository: IChurchRepository,
    private readonly storage: IStorageService = StorageProviderService.getInstance()
  ) {}

  async execute(
    request: RegisterMemberByTokenRequest
  ): Promise<RegisterMemberByTokenResult> {
    const church = await this.getChurchByToken(request.token)

    const normalizedDni = request.dni
      ? request.dni.replace(/\D/g, "")
      : undefined
    const normalizedEmail = request.email
      ? request.email.trim().toLowerCase()
      : undefined

    const churchMembers = await this.memberRepository.all(church.getChurchId())

    const matches = churchMembers.filter((m) => {
      const dniMatch =
        normalizedDni && m.getDni().replace(/\D/g, "") === normalizedDni
      const emailMatch =
        normalizedEmail && m.getEmail().trim().toLowerCase() === normalizedEmail
      return dniMatch || emailMatch
    })

    if (matches.length > 0) {
      const approvedOrInactive = matches.find(
        (m) =>
          m.getStatus() === MemberStatus.APPROVED ||
          m.getStatus() === MemberStatus.INACTIVE
      )

      if (approvedOrInactive) {
        throw new MemberAlreadyExists()
      }

      if (normalizedDni && normalizedEmail && matches.length > 1) {
        const dniMember = matches.find(
          (m) => m.getDni().replace(/\D/g, "") === normalizedDni
        )
        const emailMember = matches.find(
          (m) => m.getEmail().trim().toLowerCase() === normalizedEmail
        )
        if (
          dniMember &&
          emailMember &&
          dniMember.getMemberId() !== emailMember.getMemberId()
        ) {
          throw new MemberAlreadyExists()
        }
      }

      const pending = matches.find(
        (m) => m.getStatus() === MemberStatus.PENDING_REVIEW
      )

      if (pending) {
        await this.updatePendingMember(pending, request)
        return { message: "MEMBER_REGISTRATION_RECEIVED" }
      }
    }

    const photoPath = await this.storage.promoteProfilePhoto(
      request.stagedProfilePhotoPath
    )

    const member = Member.create({
      name: request.fullName,
      phone: request.phone,
      dni: request.dni ?? "",
      church,
      birthdate: request.birthdate ?? new Date("1900-01-01"),
      email: request.email ?? "",
      conversionDate: new Date(),
      isTreasurer: false,
      isMinister: false,
      status: MemberStatus.PENDING_REVIEW,
      profilePhoto: photoPath,
      gender: request.gender,
      address: request.address,
      lgpdConsent: request.lgpdConsentAccepted
        ? {
            accepted: true,
            acceptedAt: new Date(),
            source: "MEMBER_SELF_REGISTRATION",
          }
        : undefined,
    })

    try {
      await this.memberRepository.upsert(member)
    } catch (error) {
      await this.storage.deleteFile(photoPath).catch(() => undefined)
      throw error
    }

    await this.deleteStagedPhoto(request.stagedProfilePhotoPath)

    this.logger.info(`Pending member created: ${member.getMemberId()}`)

    return { message: "MEMBER_REGISTRATION_RECEIVED" }
  }

  private async getChurchByToken(token: string) {
    const church = await this.churchRepository.one({
      "memberRegistration.token": token,
    })

    if (!church) {
      throw new TokenNotFound()
    }

    return church
  }

  private async updatePendingMember(
    member: Member,
    request: RegisterMemberByTokenRequest
  ): Promise<void> {
    const previousPhotoPath = member.getProfilePhoto()
    const photoPath = await this.storage.promoteProfilePhoto(
      request.stagedProfilePhotoPath
    )

    member.setName(request.fullName)
    member.setPhone(request.phone)
    if (request.dni) member.setDni(request.dni)
    if (request.email) member.setEmail(request.email)
    if (request.birthdate) member.setBirthdate(request.birthdate)
    if (request.gender) member.setGender(request.gender)
    if (request.address) member.setAddress(request.address)
    member.setProfilePhoto(photoPath)
    member.setLgpdConsent(
      request.lgpdConsentAccepted
        ? {
            accepted: true,
            acceptedAt: new Date(),
            source: "MEMBER_SELF_REGISTRATION",
          }
        : undefined
    )

    try {
      await this.memberRepository.upsert(member)
    } catch (error) {
      await this.storage.deleteFile(photoPath).catch(() => undefined)
      throw error
    }

    await this.deleteStagedPhoto(request.stagedProfilePhotoPath)

    if (previousPhotoPath && previousPhotoPath !== photoPath) {
      await this.storage.deleteFile(previousPhotoPath).catch(() => undefined)
    }

    this.logger.info(`Pending member updated: ${member.getMemberId()}`)
  }

  private async deleteStagedPhoto(stagedProfilePhotoPath: string) {
    await this.storage
      .deleteFile(stagedProfilePhotoPath)
      .catch((error: any) => {
        this.logger.error("Unable to delete staged member profile photo", {
          stagedProfilePhotoPath,
          message: error?.message ?? "Unknown error",
        })
      })
  }
}
