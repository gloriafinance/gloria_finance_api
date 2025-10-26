import { RecordAssetInventory, RecordAssetInventoryRequest } from "@/Patrimony"
import { AssetMongoRepository } from "@/Patrimony/infrastructure/persistence"
import { HttpStatus } from "@/Shared/domain"
import domainResponse from "@/Shared/helpers/domainResponse"
import { Response } from "express"

export const recordAssetInventoryController = async (
  request: RecordAssetInventoryRequest,
  res: Response
) => {
  try {
    const asset = await new RecordAssetInventory(
      AssetMongoRepository.getInstance()
    ).execute(request)

    res.status(HttpStatus.OK).send(asset)
  } catch (error) {
    domainResponse(error, res)
  }
}
