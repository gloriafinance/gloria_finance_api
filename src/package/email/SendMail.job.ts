import { SendMailService } from "./service/SendMail.service"
import { Logger } from "@/Shared/adapter"
import type { IJob } from "@/package/queue/domain"
import type { Mail } from "@/package/email/domain/types/mail.type"

export class SendMailJob implements IJob {
  private logger = Logger(SendMailJob.name)

  async handle(args: Mail): Promise<void> {
    const payload = args

    this.logger.info(
      `Sending email to ${payload.to}, subject ${payload.subject}`
    )

    await SendMailService(payload)
  }
}
