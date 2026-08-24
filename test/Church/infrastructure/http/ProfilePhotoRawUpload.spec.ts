import { Readable } from "node:stream"
import { uploadRawProfilePhoto } from "@/Church/infrastructure/http/ProfilePhotoRawUpload"
import {
  HttpStatus,
  InvalidProfilePhotoContent,
  type IStorageService,
} from "@/Shared/domain"

describe("uploadRawProfilePhoto", () => {
  const storage = {
    uploadOptimizedProfilePhoto: jest.fn(),
  } as unknown as IStorageService

  const response = () => {
    const res = { status: jest.fn(), send: jest.fn() }
    res.status.mockReturnValue(res)
    return res
  }

  beforeEach(() => jest.clearAllMocks())

  it("streams an accepted image without requiring Content-Length", async () => {
    const res = response()
    ;(storage.uploadOptimizedProfilePhoto as jest.Mock).mockImplementation(
      async (source: Readable) => {
        for await (const _chunk of source) {
        }
        return "profile-photos/staged/photo.webp"
      }
    )

    const result = await uploadRawProfilePhoto(
      new Request("https://example.com/photo", {
        method: "POST",
        headers: { "content-type": "image/jpeg" },
        body: new Uint8Array([1, 2, 3]),
      }),
      res as any,
      storage
    )

    expect(result).toBe("profile-photos/staged/photo.webp")
    expect(storage.uploadOptimizedProfilePhoto).toHaveBeenCalledWith(
      expect.any(Readable),
      "image/jpeg"
    )
    expect(res.status).not.toHaveBeenCalled()
  })

  it("rejects an unsupported content type before reading the body", async () => {
    const res = response()
    const result = await uploadRawProfilePhoto(
      new Request("https://example.com/photo", {
        method: "POST",
        headers: { "content-type": "image/gif" },
        body: new Uint8Array([1]),
      }),
      res as any,
      storage
    )

    expect(result).toBeUndefined()
    expect(res.status).toHaveBeenCalledWith(HttpStatus.UNSUPPORTED_MEDIA_TYPE)
  })

  it("returns 415 only for invalid image content", async () => {
    const res = response()
    ;(storage.uploadOptimizedProfilePhoto as jest.Mock).mockRejectedValue(
      new InvalidProfilePhotoContent()
    )

    await expect(
      uploadRawProfilePhoto(
        new Request("https://example.com/photo", {
          method: "POST",
          headers: { "content-type": "image/jpeg" },
          body: new Uint8Array([1]),
        }),
        res as any,
        storage
      )
    ).resolves.toBeUndefined()

    expect(res.status).toHaveBeenCalledWith(HttpStatus.UNSUPPORTED_MEDIA_TYPE)
  })

  it("rethrows storage failures for the controller error handler", async () => {
    const res = response()
    const storageFailure = new Error("GCS unavailable")
    ;(storage.uploadOptimizedProfilePhoto as jest.Mock).mockRejectedValue(
      storageFailure
    )

    await expect(
      uploadRawProfilePhoto(
        new Request("https://example.com/photo", {
          method: "POST",
          headers: { "content-type": "image/jpeg" },
          body: new Uint8Array([1]),
        }),
        res as any,
        storage
      )
    ).rejects.toBe(storageFailure)

    expect(res.status).not.toHaveBeenCalled()
  })
})
