jest.mock("@/Shared/infrastructure/services/StorageProvider.service", () => ({
  StorageProviderService: {
    getInstance: jest.fn(),
  },
}))

import { UpdateMemberProfilePhoto } from "@/Church/applications/members/UpdateMemberProfilePhoto"
import { MemberNotFound } from "@/Church/domain/exceptions/MemberNotFound.exception"
import { InvalidMemberStatus } from "@/Church/domain/exceptions/InvalidMemberStatus.exception"
import { MemberStatus } from "@/Church/domain/enums/MemberStatus.enum"
import { type IStorageService } from "@/Shared/domain"

const createMember = (overrides: Record<string, unknown> = {}) =>
  ({
    getStatus: () => MemberStatus.APPROVED,
    getProfilePhoto: () => undefined,
    setProfilePhoto: jest.fn(),
    ...overrides,
  }) as any

describe("UpdateMemberProfilePhoto", () => {
  const memberRepository = {
    one: jest.fn(),
    upsert: jest.fn(),
    list: jest.fn(),
    all: jest.fn(),
  } as any

  const storage = {
    uploadFile: jest.fn(),
    downloadFile: jest.fn(),
    deleteFile: jest.fn(),
    setBucketName: jest.fn(),
    promoteProfilePhoto: jest.fn(),
    uploadOptimizedProfilePhoto: jest.fn(),
  } as unknown as jest.Mocked<IStorageService>

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("throws when member scope is missing", async () => {
    const useCase = new UpdateMemberProfilePhoto(memberRepository, storage)

    await expect(
      useCase.execute({ churchId: "church-1" } as any)
    ).rejects.toBeInstanceOf(MemberNotFound)
  })

  it("throws when member does not exist", async () => {
    memberRepository.one.mockResolvedValue(null as any)

    const useCase = new UpdateMemberProfilePhoto(memberRepository, storage)

    await expect(
      useCase.execute({
        churchId: "church-1",
        memberId: "member-1",
        stagedProfilePhotoPath: "profile-photos/staged/photo.webp",
      })
    ).rejects.toBeInstanceOf(MemberNotFound)
  })

  it("throws when member status does not allow profile photo updates", async () => {
    memberRepository.one.mockResolvedValue(
      createMember({
        getStatus: () => MemberStatus.PENDING_REVIEW,
      })
    )

    const useCase = new UpdateMemberProfilePhoto(memberRepository, storage)

    await expect(
      useCase.execute({
        churchId: "church-1",
        memberId: "member-1",
        stagedProfilePhotoPath: "profile-photos/staged/photo.webp",
      })
    ).rejects.toBeInstanceOf(InvalidMemberStatus)
  })

  it("updates the member profile photo, removes the previous file and returns a URL", async () => {
    const member = createMember({
      getProfilePhoto: () => "2025/5/old-photo.jpg",
    })
    memberRepository.one.mockResolvedValue(member)
    memberRepository.upsert.mockResolvedValue(undefined)
    storage.promoteProfilePhoto.mockResolvedValue("2026/6/new-photo.webp")
    storage.downloadFile.mockResolvedValue(
      "https://cdn.example.com/new-photo.jpg"
    )
    storage.deleteFile.mockResolvedValue(undefined)

    const useCase = new UpdateMemberProfilePhoto(memberRepository, storage)
    const result = await useCase.execute({
      churchId: "church-1",
      memberId: "member-1",
      stagedProfilePhotoPath: "profile-photos/staged/photo.webp",
    })

    expect(storage.promoteProfilePhoto).toHaveBeenCalledWith(
      "profile-photos/staged/photo.webp"
    )
    expect(memberRepository.upsert).toHaveBeenCalledTimes(1)
    expect(member.setProfilePhoto).toHaveBeenCalledWith("2026/6/new-photo.webp")
    expect(storage.deleteFile).toHaveBeenCalledWith("2025/5/old-photo.jpg")
    expect(storage.downloadFile).toHaveBeenCalledWith("2026/6/new-photo.webp")
    expect(result).toEqual({
      profilePhoto: "2026/6/new-photo.webp",
      profilePhotoUrl: "https://cdn.example.com/new-photo.jpg",
    })
  })

  it("rolls back the uploaded file when persistence fails", async () => {
    memberRepository.one.mockResolvedValue(createMember())
    memberRepository.upsert.mockRejectedValue(new Error("db down"))
    storage.promoteProfilePhoto.mockResolvedValue("2026/6/new-photo.webp")
    storage.deleteFile.mockResolvedValue(undefined)

    const useCase = new UpdateMemberProfilePhoto(memberRepository, storage)

    await expect(
      useCase.execute({
        churchId: "church-1",
        memberId: "member-1",
        stagedProfilePhotoPath: "profile-photos/staged/photo.webp",
      })
    ).rejects.toThrow("db down")

    expect(storage.deleteFile).toHaveBeenCalledWith("2026/6/new-photo.webp")
    expect(storage.downloadFile).not.toHaveBeenCalled()
  })
})
