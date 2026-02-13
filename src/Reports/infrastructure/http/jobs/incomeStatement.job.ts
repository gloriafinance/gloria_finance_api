import { QueueName, type IJob } from "@/package/queue/domain"
import {
  HandlebarsHTMLAdapter,
  Logger,
  PuppeteerAdapter,
} from "@/Shared/adapter"
import { NoOpStorage, QueueService } from "@/Shared/infrastructure"
import type { IncomeStatementResponse } from "@/Reports/domain"
import * as fs from "fs"
import type { Mail } from "@/package/email/domain/types/mail.type"
import { TemplateEmail } from "@/package/email/domain/enum/templateEmail.enum"

export type IncomeStatementJobRequest = {
  incomeStatement: IncomeStatementResponse
  lang: string
  email: string
  client: string
}

export class IncomeStatementJob implements IJob {
  private logger = Logger(IncomeStatementJob.name)

  async handle(args: IncomeStatementJobRequest): Promise<any | void> {
    this.logger.info(`Starting to generate PDF for income statement...`, args)
    const { incomeStatement, lang, email, client } = args

    const pdfPath = await new PuppeteerAdapter(
      new HandlebarsHTMLAdapter(),
      NoOpStorage.getInstance()
    )
      .htmlTemplate("financial_report", args.incomeStatement, lang)
      .toPDF(false)

    const year = incomeStatement.period.year
    const month = incomeStatement.period.month
    const fileName = `financial-report-${year}${month ? `-${month}` : ""}.pdf`
    const normalizedMonth = month ? String(month).padStart(2, "0") : undefined
    const reportPeriod = normalizedMonth
      ? `${normalizedMonth}/${year}`
      : `${year}`

    QueueService.getInstance().dispatch<Mail>(QueueName.SendMailJob, {
      to: email,
      subject: "Financial Report",
      template: TemplateEmail.IncomeStatement,
      clientName: client,
      context: {
        lang,
        reportPeriod,
      },
      attachments: [
        {
          filename: fileName,
          contentBase64: fs.readFileSync(pdfPath).toString("base64"),
          contentType: "application/pdf",
        },
      ],
    })
  }
}
