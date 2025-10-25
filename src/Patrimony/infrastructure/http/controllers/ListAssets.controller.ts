import { ListAssets, ListAssetsRequest } from "@/Patrimony"
import { Response } from "express"
import { HttpStatus } from "@/Shared/domain"
import domainResponse from "@/Shared/helpers/domainResponse"
import { AssetMongoRepository } from "@/Patrimony/infrastructure/persistence"

export const listAssetsController = async (
  request: ListAssetsRequest,
  res: Response
) => {
  try {
    const result = await new ListAssets(
      AssetMongoRepository.getInstance()
    ).execute(request)

    res.status(HttpStatus.OK).send(result)
  } catch (error) {
    domainResponse(error, res)
  }
}
