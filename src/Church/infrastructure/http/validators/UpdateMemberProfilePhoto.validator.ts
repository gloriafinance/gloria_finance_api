import { Logger } from "@/Shared/adapter"
import { HttpStatus } from "@/Shared/domain"
import { Validator } from "node-input-validator"
import type { NextFunction, ServerResponse } from "bun-platform-kit"

const logger = Logger("UpdateMemberProfilePhotoValidator")

const allowedMimes = ["image/jpeg", "image/png", "image/webp"]
const maxSize = 3 * 1024 * 1024

export const UpdateMemberProfilePhotoValidator = async (
  req: Request,
  res: ServerResponse,
  next: NextFunction
): Promise<void> => {
  const files = (req as any).files?.profilePhoto
  const profilePhoto = (Array.isArray(files) ? files[0] : files) as
    | { name?: string; type?: string; size?: number }
    | undefined

  const payload = {
    profilePhoto,
  }

  if (!profilePhoto) {
    return res.status(HttpStatus.UNPROCESSABLE_ENTITY).send({
      code: "PROFILE_PHOTO_REQUIRED",
      message: "Profile photo is required",
    })
  }

  logger.info("Validating member profile photo payload", {
    hasFile: Boolean(profilePhoto),
    fileName: profilePhoto?.name,
    fileType: profilePhoto?.type,
    fileSize: profilePhoto?.size,
  })

  const validator = new Validator(payload, {
    profilePhoto: "required",
    "profilePhoto.name": "required|string",
    "profilePhoto.type": `required|string|in:${allowedMimes.join(",")}`,
    "profilePhoto.size": "required|integer",
  })

  const matched = await validator.check()

  if (!matched) {
    if (validator.errors["profilePhoto.type"]) {
      return res.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE).send({
        code: "INVALID_PROFILE_PHOTO",
        message: "Invalid photo format. Allowed: jpeg, png, webp",
      })
    }

    return res.status(HttpStatus.UNPROCESSABLE_ENTITY).send({
      code: "PROFILE_PHOTO_INVALID",
      message: "Profile photo is invalid",
    })
  }

  if ((profilePhoto?.size ?? 0) > maxSize) {
    return res.status(HttpStatus.PAYLOAD_TOO_LARGE).send({
      code: "PROFILE_PHOTO_TOO_LARGE",
      profilePhoto: {
        message: "Profile photo must be at most 3 MB",
        rule: "max",
      },
      message: "Profile photo must be at most 3 MB",
    })
  }

  ;(req as any).body = {
    ...(req as any).body,
    profilePhoto,
  }

  next()
}
