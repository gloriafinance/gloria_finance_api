import { HandlebarsHTMLAdapter, PuppeteerAdapter } from "@/Shared/adapter"
import { NoOpStorage } from "@/Shared/infrastructure"
import { GenerateInventoryReport, InventoryReportRequest } from "@/Patrimony"
import { Response } from "express"
import domainResponse from "@/Shared/helpers/domainResponse"
import { AssetMongoRepository } from "@/Patrimony/infrastructure/persistence"
import { promises as fs } from "fs"
import { ChurchMongoRepository } from "@/Church/infrastructure"

export const generateInventoryReportController = async (
  request: InventoryReportRequest,
  res: Response
) => {
  try {
    const file = await new GenerateInventoryReport(
      ChurchMongoRepository.getInstance(),
      AssetMongoRepository.getInstance(),
      new PuppeteerAdapter(
        new HandlebarsHTMLAdapter(),
        NoOpStorage.getInstance()
      )
    ).execute(request)

    const { path, filename } = file

    res.download(path, filename, (error) => {
      fs.unlink(path).catch(() => undefined)
      //fs.unlink(path, () => undefined)

      if (error && !res.headersSent) {
        domainResponse(error, res)
      }
    })
  } catch (error) {
    domainResponse(error, res)
  }
}
