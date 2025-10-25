import { Logger } from "@/Shared/adapter"
import {
  AssetAttachment,
  AssetNotFoundException,
  AssetResponse,
  IAssetRepository,
  UpdateAssetRequest,
} from "../domain"
import { mapAssetToResponse } from "./mappers/AssetResponse.mapper"
import { v4 } from "uuid"

const sanitizeIds = (ids: string[]): string[] =>
  ids
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter((value) => value.length > 0)

export type UpdateAssetResult = {
  asset: AssetResponse
  removedAttachments: AssetAttachment[]
}

export class UpdateAsset {
  private readonly logger = Logger(UpdateAsset.name)

  constructor(private readonly repository: IAssetRepository) {}

  async execute(request: UpdateAssetRequest): Promise<UpdateAssetResult> {
    this.logger.info("Updating patrimony asset", request)

    const asset = await this.repository.one({ assetId: request.assetId })

    if (!asset) {
      throw new AssetNotFoundException()
    }

    const existingAttachments = asset.getAttachments() ?? []
    const removalIds = new Set(sanitizeIds(request.attachmentsToRemove ?? []))
    const removedAttachments = existingAttachments.filter((attachment) =>
      removalIds.has(attachment.attachmentId)
    )
    const preservedAttachments = existingAttachments.filter(
      (attachment) => !removalIds.has(attachment.attachmentId)
    )

    const incomingAttachments =
      Array.isArray(request.attachments) && request.attachments.length > 0
        ? request.attachments
        : []

    const newAttachments = incomingAttachments.map((attachment) => ({
      attachmentId: v4(),
      name: attachment.name,
      url: attachment.url!,
      mimetype: attachment.mimetype!,
      size: attachment.size!,
      uploadedAt: new Date(),
    }))

    const shouldUpdateAttachments =
      removalIds.size > 0 || newAttachments.length > 0

    const attachmentsPayload = shouldUpdateAttachments
      ? [...preservedAttachments, ...newAttachments]
      : undefined

    const acquisitionDate = request.acquisitionDate
      ? new Date(request.acquisitionDate)
      : undefined

    let value =
      typeof request.value !== "undefined" ? Number(request.value) : undefined

    if (typeof value === "number" && Number.isNaN(value)) {
      value = undefined
    }

    asset.updateDetails(
      {
        name: request.name,
        category: request.category,
        acquisitionDate,
        value,
        churchId: request.churchId,
        location: request.location,
        responsibleId: request.responsibleId,
        status: request.status,
        attachments: attachmentsPayload,
      },
      {
        performedBy: request.performedBy,
        notes: request.notes,
      }
    )

    await this.repository.upsert(asset)

    return {
      asset: mapAssetToResponse(asset),
      removedAttachments: shouldUpdateAttachments ? removedAttachments : [],
    }
  }
}
