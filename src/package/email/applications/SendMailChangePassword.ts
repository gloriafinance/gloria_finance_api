import { type IQueueService, QueueName } from "@/package/queue/domain"
import { TemplateEmail } from "../domain/enum/templateEmail.enum"
import { User } from "@/SecuritySystem/domain"
import { Logger } from "@/Shared/adapter"

export class SendMailChangePassword {
  private logger = Logger(SendMailChangePassword.name)

  constructor(private readonly queueService: IQueueService) {}

  execute(user: User, password: string) {
    this.logger.info(
      `Sending email of the change password to ${user.getEmail()}`
    )

    this.queueService.dispatch(QueueName.SendMailJob, {
      to: user.getEmail(),
      subject: "Nova senha",
      template: TemplateEmail.RecoveryPassword,
      clientName: user.getName(),
      context: {
        temporal_password: password,
      },
    })
  }
}
