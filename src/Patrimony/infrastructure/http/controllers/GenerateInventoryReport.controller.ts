import { HandlebarsHTMLAdapter, PuppeteerAdapter } from "@/Shared/adapter"
import { NoOpStorage } from "@/Shared/infrastructure"
import { GenerateInventoryReport, InventoryReportRequest } from "@/Patrimony"
import { Response } from "express"
import { HttpStatus } from "@/Shared/domain"
import domainResponse from "@/Shared/helpers/domainResponse"
import { AssetMongoRepository } from "@/Patrimony/infrastructure/persistence"

export const generateInventoryReportController = async (
  request: InventoryReportRequest,
  res: Response
) => {
  try {
    const result = await new GenerateInventoryReport(
      AssetMongoRepository.getInstance(),
      new PuppeteerAdapter(
        new HandlebarsHTMLAdapter(),
        NoOpStorage.getInstance()
      )
    ).execute(request)

    res.status(HttpStatus.OK).send(result)
  } catch (error) {
    domainResponse(error, res)
  }
}
