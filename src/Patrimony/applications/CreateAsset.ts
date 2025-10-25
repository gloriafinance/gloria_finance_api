import { Logger } from "@/Shared/adapter"
import {
  Asset,
  AssetAttachmentLimitException,
  AssetStatus,
  CreateAssetRequest,
  IAssetRepository,
  AssetCodeGenerator,
} from "../domain"
import { mapAssetToResponse } from "./mappers/AssetResponse.mapper"

const MAX_ATTACHMENTS = 3

export class CreateAsset {
  private readonly logger = Logger(CreateAsset.name)

  constructor(
    private readonly repository: IAssetRepository,
    private readonly codeGenerator: AssetCodeGenerator = new AssetCodeGenerator(
      repository
    )
  ) {}

  async execute(request: CreateAssetRequest) {
    this.logger.info("Creating patrimony asset", request)

    const attachments = (request.attachments ?? []).map((attachment) => ({
      name: attachment.name,
      url: attachment.url!,
      mimetype: attachment.mimetype!,
      size: attachment.size!,
    }))

    if (attachments.length > MAX_ATTACHMENTS) {
      throw new AssetAttachmentLimitException()
    }

    const code = await this.codeGenerator.generate()

    const asset = Asset.create(
      {
        code,
        name: request.name,
        category: request.category,
        acquisitionDate: new Date(request.acquisitionDate),
        value: Number(request.value),
        congregationId: request.congregationId,
        location: request.location,
        responsibleId: request.responsibleId,
        status: request.status ?? AssetStatus.ACTIVE,
        attachments,
      },
      {
        performedBy: request.performedBy,
        notes: request.notes,
      }
    )

    await this.repository.upsert(asset)

    this.logger.info("Asset stored successfully", {
      assetId: asset.getAssetId(),
      code: asset.getCode(),
    })

    return mapAssetToResponse(asset)
  }
}
