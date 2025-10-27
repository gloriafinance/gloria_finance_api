import { Logger } from "@/Shared/adapter"
import {
  Asset,
  AssetStatus,
  CreateAssetRequest,
  IAssetRepository,
} from "../domain"
import { IMemberRepository, MemberNotFound } from "@/Church/domain"
import { mapAssetToResponse } from "./mappers/AssetResponse.mapper"

export class CreateAsset {
  private readonly logger = Logger(CreateAsset.name)

  constructor(
    private readonly repository: IAssetRepository,
    private readonly memberRepository: IMemberRepository
  ) {}

  async execute(request: CreateAssetRequest) {
    this.logger.info("Creating patrimony asset", request)

    const attachments = (request.attachments ?? []).map((attachment) => ({
      name: attachment.name,
      url: attachment.url!,
      mimetype: attachment.mimetype!,
      size: attachment.size!,
    }))

    const responsibleMember = await this.memberRepository.one({
      memberId: request.responsibleId,
    })

    if (!responsibleMember) {
      throw new MemberNotFound()
    }

    const asset = Asset.create(
      {
        code: request.code,
        name: request.name,
        category: request.category,
        acquisitionDate: new Date(request.acquisitionDate),
        value: request.value,
        quantity: request.quantity,
        churchId: request.churchId,
        location: request.location,
        responsible: {
          memberId: responsibleMember.getMemberId(),
          name: responsibleMember.getName(),
          email: responsibleMember.getEmail(),
          phone: responsibleMember.getPhone(),
        },
        status: request.status ?? AssetStatus.ACTIVE,
        attachments,
      },
      {
        performedByDetails: request.performedByDetails,
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
