import { Response } from "express"
import { promises as fs } from "fs"
import {
  FinanceRecordReportRequest,
  FinanceRecordReportFormat,
} from "@/Financial/domain"
import { GenerateFinanceRecordReport } from "../../../applications"
import { FinanceRecordMongoRepository } from "../../persistence"
import domainResponse from "@/Shared/helpers/domainResponse"
import {
  HandlebarsHTMLAdapter,
  Logger,
  PuppeteerAdapter,
  XLSExportAdapter,
} from "@/Shared/adapter"
import { NoOpStorage } from "@/Shared/infrastructure"
import { ChurchMongoRepository } from "@/Church/infrastructure"

const DEFAULT_PAGE = 1
const DEFAULT_PER_PAGE = 1000

const sanitizeFormat = (
  format?: string
): FinanceRecordReportFormat | undefined => {
  if (!format) {
    return undefined
  }

  const normalized = format.toLowerCase()

  if (normalized === "pdf") {
    return "pdf"
  }

  return "csv"
}

export const GenerateFinanceRecordReportController = async (
  req: FinanceRecordReportRequest,
  res: Response
): Promise<void> => {
  const logger = Logger("GenerateFinanceRecordReportController")

  try {
    const normalizedRequest: FinanceRecordReportRequest = {
      ...req,
      format: sanitizeFormat(req.format),
      page: req.page ?? DEFAULT_PAGE,
      perPage: req.perPage ?? DEFAULT_PER_PAGE,
    }

    logger.info("Processando solicitação de relatório financeiro", {
      ...normalizedRequest,
      format: normalizedRequest.format ?? "csv",
    })

    const file = await new GenerateFinanceRecordReport(
      ChurchMongoRepository.getInstance(),
      FinanceRecordMongoRepository.getInstance(),
      new PuppeteerAdapter(
        new HandlebarsHTMLAdapter(),
        NoOpStorage.getInstance()
      ),
      new XLSExportAdapter()
    ).execute(normalizedRequest)

    const { path, filename } = file

    res.download(path, filename, (error) => {
      fs.unlink(path).catch(() => undefined)

      if (error && !res.headersSent) {
        domainResponse(error, res)
      }
    })

    logger.info("Relatório financeiro gerado com sucesso")
  } catch (error) {
    logger.error("Erro ao gerar relatório financeiro", error)
    domainResponse(error, res)
  }
}
