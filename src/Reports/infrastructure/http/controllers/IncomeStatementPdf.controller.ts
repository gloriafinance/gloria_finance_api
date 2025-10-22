import { Response } from "express"
import * as fs from "fs"
import { BaseReportRequest } from "../../../domain"
import { IncomeStatement } from "../../../applications"
import domainResponse from "../../../../Shared/helpers/domainResponse"
import { FinanceRecordMongoRepository } from "@/Financial/infrastructure"
import { ChurchMongoRepository } from "@/Church/infrastructure"
import { HandlebarsHTMLAdapter, PuppeteerAdapter } from "@/Shared/adapter"
import { NoOpStorage } from "@/Shared/infrastructure"

export const IncomeStatementPdfController = async (
  req: BaseReportRequest,
  res: Response
): Promise<void> => {
  try {
    const incomeStatement = await new IncomeStatement(
      FinanceRecordMongoRepository.getInstance(),
      ChurchMongoRepository.getInstance()
    ).execute(req)

    const pdfPath = await new PuppeteerAdapter(
      new HandlebarsHTMLAdapter(),
      NoOpStorage.getInstance()
    )
      .htmlTemplate("financial_report", incomeStatement)
      .toPDF(false)

    const year = incomeStatement.period.year ?? req.year
    const month = incomeStatement.period.month ?? req.month
    const fileName = `financial-report-${year}${
      month ? `-${month}` : ""
    }.pdf`.replace(/\s+/g, "-")

    res.download(pdfPath, fileName, (error) => {
      fs.unlink(pdfPath, () => undefined)

      if (error && !res.headersSent) {
        domainResponse(error, res)
      }
    })
  } catch (error) {
    domainResponse(error, res)
  }
}
