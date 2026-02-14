import { TemplateEmail } from "@/package/email/domain/enum/templateEmail.enum"
import type { Mail } from "@/package/email/domain/types/mail.type"
import { QueueName, type IJob } from "@/package/queue/domain"
import type { DREResponse } from "@/Reports/domain"
import { HandlebarsHTMLAdapter, PuppeteerAdapter } from "@/Shared/adapter"
import { NoOpStorage, QueueService } from "@/Shared/infrastructure"
import * as fs from "fs"

export type DREJobRequest = {
  dreReport: DREResponse
  lang: string
  email: string
  client: string
}

export class DREJob implements IJob {
  async handle(args: DREJobRequest): Promise<any | void> {
    const { dreReport, lang, email, client } = args

    const pdfPath = await new PuppeteerAdapter(
      new HandlebarsHTMLAdapter(),
      NoOpStorage.getInstance()
    )
      .htmlTemplate("dre_report", dreReport, lang)
      .toPDF(false)

    const year = dreReport.year
    const month = dreReport.month
    const fileName = `dre-${year}${month ? `-${month}` : ""}.pdf`

    const normalizedMonth = month ? String(month).padStart(2, "0") : undefined
    const reportPeriod = normalizedMonth
      ? `${normalizedMonth}/${year}`
      : `${year}`

    QueueService.getInstance().dispatch<Mail>(QueueName.SendMailJob, {
      to: email,
      subject: "Financial Report",
      template: TemplateEmail.DRE,
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
