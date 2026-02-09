import type { CreateAssetAttachmentRequest } from "@/Patrimony"
import { StorageGCP } from "@/Shared/infrastructure"

const storage = StorageGCP.getInstance(process.env.BUCKET_FILES!)
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

    if (!file) {
      continue
    }

    const storedPath = await storage.uploadFile(file)
    uploadedAccumulator.push(storedPath)
    const url = storedPath
    const mimetype = file.mimetype
    const sizeValue = file.size
    const name = file.name

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
