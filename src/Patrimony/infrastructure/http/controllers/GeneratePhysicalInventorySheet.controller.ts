import {
  GeneratePhysicalInventorySheet,
  PhysicalInventorySheetRequest,
} from "@/Patrimony"
import { AssetMongoRepository } from "@/Patrimony/infrastructure/persistence"
import domainResponse from "@/Shared/helpers/domainResponse"
import { Response } from "express"
import { promises as fs } from "fs"

export const generatePhysicalInventorySheetController = async (
  request: PhysicalInventorySheetRequest,
  res: Response
) => {
  try {
    const file = await new GeneratePhysicalInventorySheet(
      AssetMongoRepository.getInstance()
    ).execute(request)

    const { path, filename } = file

    res.download(path, filename, (error) => {
      fs.unlink(path).catch(() => undefined)

      if (error && !res.headersSent) {
        domainResponse(error, res)
      }
    })
  } catch (error) {
    domainResponse(error, res)
  }
}
