import { CreateAsset, CreateAssetRequest } from "@/Patrimony"
import { Response } from "express"
import {
  AttachmentValidationError,
  cleanupUploads,
  normalizeAttachments,
} from "@/Patrimony/infrastructure/http/controllers/Helper.controller"
import { HttpStatus } from "@/Shared/domain"
import domainResponse from "@/Shared/helpers/domainResponse"
import { AssetMongoRepository } from "@/Patrimony/infrastructure/persistence"

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

    const result = await new CreateAsset(
      AssetMongoRepository.getInstance()
    ).execute({
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
