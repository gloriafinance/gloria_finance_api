jest.mock("@/Shared/infrastructure", () => ({
  StorageProviderService: {
    getInstance: jest.fn(),
  },
}))

import { RegisterMemberByToken } from "@/Church/applications/members/RegisterMemberByToken"
import { type IStorageService } from "@/Shared/domain"

describe("RegisterMemberByToken", () => {
  const memberRepository = {
    all: jest.fn(),
    upsert: jest.fn(),
  } as any
  const churchRepository = { one: jest.fn() } as any
  const storage = {
    deleteFile: jest.fn(),
    promoteProfilePhoto: jest.fn(),
  } as unknown as jest.Mocked<IStorageService>
  const church = {
    getChurchId: () => "church-1",
    getName: () => "Test Church",
    getLang: () => "pt-BR",
  } as any
  const request = {
    token: "registration-token",
    fullName: "Jane Doe",
    phone: "5511999999999",
    dni: "12345678901",
    email: "jane@example.com",
    lgpdConsentAccepted: true,
    stagedProfilePhotoPath: "profile-photos/staged/upload-id.webp",
  }

  beforeEach(() => {
    jest.clearAllMocks()
    churchRepository.one.mockResolvedValue(church)
    memberRepository.all.mockResolvedValue([])
    storage.promoteProfilePhoto.mockResolvedValue(
      "profile-photos/upload-id.webp"
    )
    storage.deleteFile.mockResolvedValue(undefined)
  })

  it("keeps the temporary photo receipt retryable after persistence fails", async () => {
    memberRepository.upsert
      .mockRejectedValueOnce(new Error("database unavailable"))
      .mockResolvedValueOnce(undefined)
    const useCase = new RegisterMemberByToken(
      memberRepository,
      churchRepository,
      storage
    )

    await expect(useCase.execute(request)).rejects.toThrow(
      "database unavailable"
    )
    expect(storage.deleteFile).toHaveBeenCalledWith(
      "profile-photos/upload-id.webp"
    )
    expect(storage.deleteFile).not.toHaveBeenCalledWith(
      "profile-photos/staged/upload-id.webp"
    )

    await expect(useCase.execute(request)).resolves.toEqual({
      message: "MEMBER_REGISTRATION_RECEIVED",
    })

    expect(storage.promoteProfilePhoto).toHaveBeenCalledTimes(2)
    expect(storage.deleteFile).toHaveBeenCalledWith(
      "profile-photos/staged/upload-id.webp"
    )
  })
})
