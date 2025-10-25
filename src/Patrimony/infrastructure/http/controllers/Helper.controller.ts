import { CreateAssetAttachmentRequest } from "@/Patrimony"
import { StorageGCP } from "@/Shared/infrastructure"

const storage = StorageGCP.getInstance(process.env.BUCKET_FILES)
type PersistableAttachment = Omit<CreateAssetAttachmentRequest, "file"> & {
  url: string
  mimetype: string
  size: number
}

export const normalizeAttachments = async (
  attachments: CreateAssetAttachmentRequest[] | undefined,
  uploadedAccumulator: string[]
): Promise<PersistableAttachment[] | undefined> => {
  if (!Array.isArray(attachments)) {
    return undefined
  }

  const normalized: PersistableAttachment[] = []

  for (const attachment of attachments) {
    const file = attachment.file
    let name = typeof attachment.name === "string" ? attachment.name : ""
    let mimetype =
      typeof attachment.mimetype === "string" ? attachment.mimetype : undefined
    let sizeValue: number | undefined

    sizeValue = attachment.size

    let url = typeof attachment.url === "string" ? attachment.url : undefined

    const storedPath = await storage.uploadFile(file)
    uploadedAccumulator.push(storedPath)
    url = storedPath
    mimetype = mimetype ?? file.mimetype
    sizeValue = sizeValue ?? file.size
    if (!name) {
      name = file.name
    }

    normalized.push({
      name,
      mimetype,
      size: sizeValue,
      url,
    })
  }

  return normalized
}

export const cleanupUploads = async (paths: string[]) => {
  if (!paths.length) {
    return
  }

  await Promise.all(
    paths.map((path) => storage.deleteFile(path).catch(() => undefined))
  )
}

export class AttachmentValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AttachmentValidationError"
  }
}
