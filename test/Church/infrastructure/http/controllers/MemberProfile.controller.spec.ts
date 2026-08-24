const findMemberExecuteMock = jest.fn()
const updateProfilePhotoExecuteMock = jest.fn()
const downloadFileMock = jest.fn()
const memberRepositoryInstanceMock = {}
const uploadRawProfilePhotoMock = jest.fn()

jest.mock("@/Church/applications", () => ({
  FindMemberById: jest.fn().mockImplementation(() => ({
    execute: findMemberExecuteMock,
  })),
  UpdateMemberProfilePhoto: jest.fn().mockImplementation(() => ({
    execute: updateProfilePhotoExecuteMock,
  })),
}))

jest.mock("@/Church/infrastructure", () => ({
  MemberMongoRepository: {
    getInstance: jest.fn(() => memberRepositoryInstanceMock),
  },
}))

jest.mock("@/Shared/helpers/domainResponse", () => ({
  __esModule: true,
  default: jest.fn(),
}))

jest.mock("@/Shared/infrastructure", () => ({
  PermissionMiddleware: jest.fn(),
  StorageProviderService: {
    getInstance: jest.fn(() => ({
      downloadFile: downloadFileMock,
    })),
  },
}))

jest.mock("@/Church/infrastructure/http/ProfilePhotoRawUpload", () => ({
  uploadRawProfilePhoto: uploadRawProfilePhotoMock,
}))

import { HttpStatus } from "@/Shared/domain"
import domainResponse from "@/Shared/helpers/domainResponse"
import { MemberProfileController } from "@/Church/infrastructure/http/controllers/MemberProfile.controller"

describe("MemberProfileController", () => {
  const buildRes = () => {
    const res = {
      status: jest.fn(),
      send: jest.fn(),
    }
    res.status.mockReturnValue(res)
    return res
  }

  const buildReq = (overrides?: Record<string, unknown>) =>
    ({
      auth: {
        churchId: "church-1",
        memberId: "member-1",
      },
      files: undefined,
      raw: new Request("https://example.com", {
        method: "PATCH",
        headers: {
          "content-type": "image/jpeg",
          "content-length": "1024",
        },
        body: new Uint8Array([1]),
      }),
      ...overrides,
    }) as any

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("returns the current member profile with the profile photo resolved to a URL", async () => {
    findMemberExecuteMock.mockResolvedValue({
      getId: () => "member-db-id",
      toPrimitives: () => ({
        memberId: "member-1",
        name: "John Doe",
        profilePhoto: "2025/6/profile.jpg",
      }),
    })
    downloadFileMock.mockResolvedValue("https://cdn.example.com/profile.jpg")

    const controller = new MemberProfileController()
    const res = buildRes()

    await controller.profile(buildReq(), res as any)

    expect(findMemberExecuteMock).toHaveBeenCalledWith({
      memberId: "member-1",
      churchId: "church-1",
    })
    expect(downloadFileMock).toHaveBeenCalledWith("2025/6/profile.jpg")
    expect(res.status).toHaveBeenCalledWith(HttpStatus.OK)
    expect(res.send).toHaveBeenCalledWith({
      id: "member-db-id",
      memberId: "member-1",
      name: "John Doe",
      profilePhoto: "2025/6/profile.jpg",
      profilePhotoUrl: "https://cdn.example.com/profile.jpg",
    })
  })

  it("keeps the profile response even when the storage URL cannot be resolved", async () => {
    findMemberExecuteMock.mockResolvedValue({
      getId: () => "member-db-id",
      toPrimitives: () => ({
        memberId: "member-1",
        name: "John Doe",
        profilePhoto: "2025/6/profile.jpg",
      }),
    })
    downloadFileMock.mockRejectedValue(new Error("storage unavailable"))

    const controller = new MemberProfileController()
    const res = buildRes()

    await controller.profile(buildReq(), res as any)

    expect(res.status).toHaveBeenCalledWith(HttpStatus.OK)
    expect(res.send).toHaveBeenCalledWith({
      id: "member-db-id",
      memberId: "member-1",
      name: "John Doe",
      profilePhoto: "2025/6/profile.jpg",
      profilePhotoUrl: null,
    })
  })

  it("returns forbidden when the token does not carry member scope", async () => {
    const controller = new MemberProfileController()
    const res = buildRes()

    await controller.profile(
      buildReq({ auth: { churchId: "church-1" } }),
      res as any
    )

    expect(findMemberExecuteMock).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN)
    expect(res.send).toHaveBeenCalledWith({
      message: "Authenticated member scope is required",
    })
  })

  it("updates only the authenticated member photo", async () => {
    uploadRawProfilePhotoMock.mockResolvedValue(
      "profile-photos/staged/profile.webp"
    )
    updateProfilePhotoExecuteMock.mockResolvedValue({
      profilePhoto: "2026/6/new-profile.jpg",
      profilePhotoUrl: "https://cdn.example.com/new-profile.jpg",
    })

    const controller = new MemberProfileController()
    const res = buildRes()

    await controller.updateProfilePhoto(
      buildReq({
        auth: {
          churchId: "church-1",
          memberId: "member-1",
        },
      }),
      res as any
    )

    expect(updateProfilePhotoExecuteMock).toHaveBeenCalledWith({
      churchId: "church-1",
      memberId: "member-1",
      stagedProfilePhotoPath: "profile-photos/staged/profile.webp",
    })
    expect(res.status).toHaveBeenCalledWith(HttpStatus.OK)
    expect(res.send).toHaveBeenCalledWith({
      message: "MEMBER_PROFILE_PHOTO_UPDATED",
      profilePhoto: "2026/6/new-profile.jpg",
      profilePhotoUrl: "https://cdn.example.com/new-profile.jpg",
    })
  })
})
