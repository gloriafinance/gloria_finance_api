import { DisposeAsset, DisposeAssetRequest } from "@/Patrimony"
import { AssetMongoRepository } from "@/Patrimony/infrastructure/persistence"
import domainResponse from "@/Shared/helpers/domainResponse"
import { HttpStatus } from "@/Shared/domain"
import { Response } from "express"

export const disposeAssetController = async (
  request: DisposeAssetRequest,
  res: Response
) => {
  try {
    const asset = await new DisposeAsset(
      AssetMongoRepository.getInstance()
    ).execute(request)

    res.status(HttpStatus.OK).send(asset)
  } catch (error) {
    domainResponse(error, res)
  }
}
