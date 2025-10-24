import { Logger } from "@/Shared/adapter"
import {
  AssetAttachment,
  AssetAttachmentLimitException,
  AssetNotFoundException,
  IAssetRepository,
  UpdateAssetRequest,
} from "../domain"
import { mapAssetToResponse } from "./mappers/AssetResponse.mapper"
import { v4 } from "uuid"

const MAX_ATTACHMENTS = 3

export class UpdateAsset {
  private readonly logger = Logger(UpdateAsset.name)

  constructor(private readonly repository: IAssetRepository) {}

  async execute(request: UpdateAssetRequest) {
    this.logger.info("Updating patrimony asset", request)

    const asset = await this.repository.one({ assetId: request.assetId })

    if (!asset) {
      throw new AssetNotFoundException()
    }

    let attachments: AssetAttachment[] | undefined

    if (request.attachments) {
      if (request.attachments.length > MAX_ATTACHMENTS) {
        throw new AssetAttachmentLimitException()
      }

      attachments = request.attachments.map((attachment) => ({
        attachmentId: v4(),
        name: attachment.name,
        url: attachment.url,
        mimetype: attachment.mimetype,
        size: attachment.size,
        uploadedAt: new Date(),
      }))
    }

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
        congregationId: request.congregationId,
        location: request.location,
        responsibleId: request.responsibleId,
        status: request.status,
        attachments,
      },
      {
        performedBy: request.performedBy,
        notes: request.notes,
      }
    )

    await this.repository.update(asset)

    return mapAssetToResponse(asset)
  }
}
