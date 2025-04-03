import { IQueue } from "@/Shared/domain"
import { Mail } from "./types/mail.type"
import { SendMailService } from "./service/SendMail.service"
import { Logger } from "@/Shared/adapter"

export class SendMail implements IQueue {
  private logger = Logger("SendMail")

  async handle(args: any): Promise<void> {
    const payload = args as Mail

    this.logger.info(
      `Sending email to ${payload.to}, subject ${payload.subject}`
    )

    await SendMailService(payload)
  }
}
