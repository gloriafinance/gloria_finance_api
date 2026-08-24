import { StorageGCP } from "@/package/gcp/infrastructure/StorageGCP"

describe("StorageGCP profile photo promotion", () => {
  it("keeps the staged source and reuses a deterministic final path", async () => {
    const source = { copy: jest.fn() }
    const destination = { exists: jest.fn().mockResolvedValue([false]) }
    const bucket = {
      file: jest.fn((path: string) =>
        path.startsWith("profile-photos/staged/") ? source : destination
      ),
    }
    const storage = new StorageGCP("church-bucket")
    ;(storage as any).storage = { bucket: jest.fn(() => bucket) }

    const finalPath = await storage.promoteProfilePhoto(
      "profile-photos/staged/upload-id.webp"
    )

    expect(finalPath).toBe("profile-photos/upload-id.webp")
    expect(source.copy).toHaveBeenCalledWith(destination)
    expect(source).not.toHaveProperty("delete")

    destination.exists.mockResolvedValue([true])
    await expect(
      storage.promoteProfilePhoto("profile-photos/staged/upload-id.webp")
    ).resolves.toBe("profile-photos/upload-id.webp")
    expect(source.copy).toHaveBeenCalledTimes(1)
  })
})
