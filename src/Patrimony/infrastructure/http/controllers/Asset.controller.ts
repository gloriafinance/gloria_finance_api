import { Response } from "express"
import domainResponse from "@/Shared/helpers/domainResponse"
import {
  CreateAssetAttachmentRequest,
  CreateAssetRequest,
  ListAssetsRequest,
  UpdateAssetRequest,
  GetAssetRequest,
  InventoryReportRequest,
} from "../../../domain"
import {
  CreateAsset,
  ListAssets,
  UpdateAsset,
  GetAsset,
  GenerateInventoryReport,
} from "../../../applications"
import { AssetMongoRepository } from "../../persistence/AssetMongoRepository"
import { HttpStatus } from "@/Shared/domain"
import { HandlebarsHTMLAdapter, PuppeteerAdapter } from "@/Shared/adapter"
import { NoOpStorage, StorageGCP } from "@/Shared/infrastructure"

const repository = AssetMongoRepository.getInstance()
const storage = StorageGCP.getInstance(process.env.BUCKET_FILES)
const pdfGenerator = new PuppeteerAdapter(
  new HandlebarsHTMLAdapter(),
  NoOpStorage.getInstance()
)

type PersistableAttachment = Omit<CreateAssetAttachmentRequest, "file"> & {
  url: string
  mimetype: string
  size: number
}

class AttachmentValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AttachmentValidationError"
  }
}

const normalizeAttachments = async (
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

    if (typeof attachment.size === "number") {
      sizeValue = attachment.size
    } else if (
      typeof attachment.size === "string" &&
      attachment.size.trim().length > 0
    ) {
      const parsed = Number(attachment.size)
      sizeValue = Number.isNaN(parsed) ? undefined : parsed
    }

    let url = typeof attachment.url === "string" ? attachment.url : undefined

    if (file) {
      const storedPath = await storage.uploadFile(file)
      uploadedAccumulator.push(storedPath)
      url = storedPath
      mimetype = mimetype ?? file.mimetype
      sizeValue = sizeValue ?? file.size
      if (!name) {
        name = file.name
      }
    }

    const normalizedName =
      typeof name === "string" && name.trim().length > 0
        ? name.trim()
        : file?.name ?? "Anexo patrimonial"

    const normalizedMimetype =
      typeof mimetype === "string" && mimetype.trim().length > 0
        ? mimetype.trim()
        : undefined

    if (!url) {
      throw new AttachmentValidationError(
        "Cada anexo deve possuir um arquivo para upload ou uma URL existente."
      )
    }

    if (!normalizedMimetype) {
      throw new AttachmentValidationError(
        "O tipo de arquivo do anexo é obrigatório."
      )
    }

    const normalizedSize =
      typeof sizeValue === "number" && !Number.isNaN(sizeValue)
        ? Number(sizeValue)
        : undefined

    if (typeof normalizedSize !== "number") {
      throw new AttachmentValidationError(
        "O tamanho do anexo é obrigatório."
      )
    }

    normalized.push({
      name: normalizedName,
      mimetype: normalizedMimetype,
      size: normalizedSize,
      url,
    })
  }

  return normalized
}

const cleanupUploads = async (paths: string[]) => {
  if (!paths.length) {
    return
  }

  await Promise.all(
    paths.map((path) => storage.deleteFile(path).catch(() => undefined))
  )
}

export const createAssetController = async (
  request: CreateAssetRequest,
  res: Response
) => {
  const uploadedPaths: string[] = []

  try {
    const normalizedAttachments = await normalizeAttachments(
      request.attachments,
      uploadedPaths
    )

    const result = await new CreateAsset(repository).execute({
      ...request,
      attachments: normalizedAttachments ?? [],
    })

    res.status(HttpStatus.CREATED).send(result)
  } catch (error) {
    await cleanupUploads(uploadedPaths)

    if (error instanceof AttachmentValidationError) {
      res.status(HttpStatus.UNPROCESSABLE_ENTITY).send({
        attachments: {
          message: error.message,
          rule: "invalid",
        },
      })
      return
    }

    domainResponse(error, res)
  }
}

export const listAssetsController = async (
  request: ListAssetsRequest,
  res: Response
) => {
  try {
    const result = await new ListAssets(repository).execute(request)

    res.status(HttpStatus.OK).send(result)
  } catch (error) {
    domainResponse(error, res)
  }
}

export const getAssetController = async (
  request: GetAssetRequest,
  res: Response
) => {
  try {
    const result = await new GetAsset(repository).execute(request)

    res.status(HttpStatus.OK).send(result)
  } catch (error) {
    domainResponse(error, res)
  }
}

export const updateAssetController = async (
  request: UpdateAssetRequest,
  res: Response
) => {
  const uploadedPaths: string[] = []
  const attachmentsProvided = Array.isArray(request.attachments)

  try {
    const normalizedAttachments = await normalizeAttachments(
      request.attachments,
      uploadedPaths
    )

    const result = await new UpdateAsset(repository).execute({
      ...request,
      attachments: attachmentsProvided
        ? normalizedAttachments ?? []
        : undefined,
    })

    res.status(HttpStatus.OK).send(result)
  } catch (error) {
    await cleanupUploads(uploadedPaths)

    if (error instanceof AttachmentValidationError) {
      res.status(HttpStatus.UNPROCESSABLE_ENTITY).send({
        attachments: {
          message: error.message,
          rule: "invalid",
        },
      })
      return
    }

    domainResponse(error, res)
  }
}

export const generateInventoryReportController = async (
  request: InventoryReportRequest,
  res: Response
) => {
  try {
    const result = await new GenerateInventoryReport(
      repository,
      pdfGenerator
    ).execute(request)

    res.status(HttpStatus.OK).send(result)
  } catch (error) {
    domainResponse(error, res)
  }
}
