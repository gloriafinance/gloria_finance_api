import { HttpStatus } from "@/Shared/domain"
import { UpdateMemberProfilePhotoValidator } from "@/Church/infrastructure/http/validators/UpdateMemberProfilePhoto.validator"

describe("UpdateMemberProfilePhotoValidator", () => {
  const buildRes = () => {
    const res = {
      status: jest.fn(),
      send: jest.fn(),
    }
    res.status.mockReturnValue(res)
    return res
  }

  it("accepts a valid profile photo and normalizes it into the request body", async () => {
    const next = jest.fn()
    const req = {
      body: {},
      files: {
        profilePhoto: {
          name: "profile.jpg",
          type: "image/jpeg",
          size: 1024,
        },
      },
    } as any
    const res = buildRes()

    await UpdateMemberProfilePhotoValidator(req, res as any, next)

    expect(res.status).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalledTimes(1)
    expect(req.body.profilePhoto).toEqual({
      name: "profile.jpg",
      type: "image/jpeg",
      size: 1024,
    })
  })

  it("rejects missing profile photos", async () => {
    const next = jest.fn()
    const req = {
      body: {},
      files: {},
    } as any
    const res = buildRes()

    await UpdateMemberProfilePhotoValidator(req, res as any, next)

    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(HttpStatus.UNPROCESSABLE_ENTITY)
    expect(res.send).toHaveBeenCalledWith({
      profilePhoto: {
        message: "The profile photo field is mandatory.",
        rule: "required",
      },
      "profilePhoto.name": {
        message: "The profilePhoto.name field is mandatory.",
        rule: "required",
      },
      "profilePhoto.size": {
        message: "The profilePhoto.size field is mandatory.",
        rule: "required",
      },
      "profilePhoto.type": {
        message: "The profilePhoto.type field is mandatory.",
        rule: "required",
      },
    })
  })

  it("rejects unsupported image formats", async () => {
    const next = jest.fn()
    const req = {
      body: {},
      files: {
        profilePhoto: {
          name: "profile.gif",
          type: "image/gif",
          size: 1024,
        },
      },
    } as any
    const res = buildRes()

    await UpdateMemberProfilePhotoValidator(req, res as any, next)

    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(HttpStatus.UNPROCESSABLE_ENTITY)
    expect(res.send).toHaveBeenCalledWith({
      "profilePhoto.type": {
        message: "The selected profilePhoto.type is invalid.",
        rule: "in",
      },
    })
  })

  it("rejects photos larger than 3 MB", async () => {
    const next = jest.fn()
    const req = {
      body: {},
      files: {
        profilePhoto: {
          name: "profile.jpg",
          type: "image/jpeg",
          size: 3 * 1024 * 1024 + 1,
        },
      },
    } as any
    const res = buildRes()

    await UpdateMemberProfilePhotoValidator(req, res as any, next)

    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(HttpStatus.UNPROCESSABLE_ENTITY)
    expect(res.send).toHaveBeenCalledWith({
      profilePhoto: {
        message: "Profile photo must be at most 3 MB",
        rule: "max",
      },
    })
  })
})
