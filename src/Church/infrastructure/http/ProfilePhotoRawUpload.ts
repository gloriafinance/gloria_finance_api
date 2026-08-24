import { Readable, Transform, type TransformCallback } from "node:stream"
import type { IStorageService } from "@/Shared/domain"
import { HttpStatus } from "@/Shared/domain"
import type { ServerResponse } from "bun-platform-kit"

const maxBytes = 25 * 1024 * 1024
const acceptedMimes = new Set(["image/jpeg", "image/png", "image/webp"])

class BodySizeLimit extends Transform {
  intBytes = 0

  override _transform(
    chunk: Buffer,
    _encoding: BufferEncoding,
    callback: TransformCallback
  ) {
    this.intBytes += chunk.length
    if (this.intBytes > maxBytes) {
      callback(new Error("PROFILE_PHOTO_TOO_LARGE"))
      return
    }
    callback(null, chunk)
  }
}

export const uploadRawProfilePhoto = async (
  request: Request,
  res: ServerResponse,
  storage: IStorageService
): Promise<string | undefined> => {
  const contentType = request.headers.get("content-type")?.toLowerCase()
  if (!contentType || !acceptedMimes.has(contentType)) {
    res.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE).send({
      code: "INVALID_PROFILE_PHOTO",
      message: "Invalid photo format. Allowed: jpeg, png, webp",
    })
    return undefined
  }

  const contentLength = Number(request.headers.get("content-length"))
  if (Number.isSafeInteger(contentLength) && contentLength > maxBytes) {
    res.status(HttpStatus.PAYLOAD_TOO_LARGE).send({
      code: "PROFILE_PHOTO_TOO_LARGE",
      message: "Profile photo must be at most 25 MB",
    })
    return undefined
  }
  if (!request.body) {
    res.status(HttpStatus.BAD_REQUEST).send({
      code: "PROFILE_PHOTO_REQUIRED",
      message: "Profile photo is required",
    })
    return undefined
  }

  try {
    return await storage.uploadOptimizedProfilePhoto(
      Readable.fromWeb(request.body as never).pipe(new BodySizeLimit()),
      contentType
    )
  } catch (error) {
    if (error instanceof Error && error.message === "PROFILE_PHOTO_TOO_LARGE") {
      res.status(HttpStatus.PAYLOAD_TOO_LARGE).send({
        code: "PROFILE_PHOTO_TOO_LARGE",
        message: "Profile photo must be at most 25 MB",
      })
      return undefined
    }
    res.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE).send({
      code: "PROFILE_PHOTO_INVALID",
      message: "Profile photo content is invalid or cannot be processed",
    })
    return undefined
  }
}
