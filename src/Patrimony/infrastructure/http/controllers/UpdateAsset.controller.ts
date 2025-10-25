import { UpdateAsset, UpdateAssetRequest } from "@/Patrimony"
import {
  AttachmentValidationError,
  cleanupUploads,
  normalizeAttachments,
} from "@/Patrimony/infrastructure/http/controllers/Helper.controller"
import { AssetMongoRepository } from "@/Patrimony/infrastructure/persistence"
import { HttpStatus } from "@/Shared/domain"
import domainResponse from "@/Shared/helpers/domainResponse"
import { Response } from "express"

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

    const { asset, removedAttachments } = await new UpdateAsset(
      AssetMongoRepository.getInstance()
    ).execute({
      ...request,
      attachments: attachmentsProvided
        ? (normalizedAttachments ?? [])
        : undefined,
    })

    await cleanupUploads(removedAttachments.map((attachment) => attachment.url))

    res.status(HttpStatus.OK).send(asset)
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
