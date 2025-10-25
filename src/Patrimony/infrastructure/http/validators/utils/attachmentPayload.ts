import { UploadedFile } from "express-fileupload"
import { CreateAssetAttachmentRequest } from "../../../../domain"

export type AttachmentNormalizationResult = {
  attachments: CreateAssetAttachmentRequest[]
  provided: boolean
}

const parseAttachmentMetadata = (
  raw: unknown
): Partial<CreateAssetAttachmentRequest>[] => {
  if (Array.isArray(raw)) {
    return raw as Partial<CreateAssetAttachmentRequest>[]
  }

  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        return parsed as Partial<CreateAssetAttachmentRequest>[]
      }
    } catch (error) {
      return []
    }
  }

  if (raw && typeof raw === "object") {
    return [raw as Partial<CreateAssetAttachmentRequest>]
  }

  return []
}

const extractFiles = (
  files: UploadedFile | UploadedFile[] | undefined
): UploadedFile[] => {
  if (!files) {
    return []
  }

  return Array.isArray(files) ? files : [files]
}

const toTrimmedString = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined
  }

  const trimmed = value.trim()

  return trimmed.length > 0 ? trimmed : undefined
}

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === "number") {
    return value
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value)

    return Number.isNaN(parsed) ? undefined : parsed
  }

  return undefined
}

export const normalizeAttachmentPayload = (
  raw: unknown,
  filesInput: UploadedFile | UploadedFile[] | undefined
): AttachmentNormalizationResult => {
  const metadata = parseAttachmentMetadata(raw)
  const files = extractFiles(filesInput)

  const provided =
    raw !== undefined && raw !== null ? true : files.length > 0

  const length = Math.max(metadata.length, files.length)

  const attachments: CreateAssetAttachmentRequest[] = []

  for (let index = 0; index < length; index++) {
    const meta = metadata[index] ?? {}
    const file = files[index]

    const name =
      toTrimmedString(meta.name) ?? file?.name ?? ""

    const mimetype =
      toTrimmedString(meta.mimetype) ?? file?.mimetype

    const size = toNumber(meta.size) ?? (file ? file.size : undefined)

    const url = toTrimmedString(meta.url)

    attachments.push({
      name,
      mimetype,
      size,
      url,
      file,
    })
  }

  return { attachments, provided }
}

export const hasMissingAttachmentSource = (
  attachments: CreateAssetAttachmentRequest[]
): boolean =>
  attachments.some(
    (attachment) => !attachment.file && !toTrimmedString(attachment.url)
  )
