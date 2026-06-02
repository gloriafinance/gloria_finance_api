import { MemberNotFound, type IMemberRepository } from "@/Church/domain"
import { type IQueueService, QueueName } from "@/package/queue/domain"
import { Logger } from "@/Shared/adapter"
import {
  type NotificationRequest,
  NotificationsTopic,
} from "@/PushNotifications/domain"
import { AccountReceivable } from "@/AccountsReceivable/domain"

export class NotifyPaymentCommitment {
  private logger = Logger(NotifyPaymentCommitment.name)
  constructor(
    private readonly memberRepository: IMemberRepository,
    private readonly queueService: IQueueService
  ) {}

  async execute(params: { account: AccountReceivable }): Promise<void> {
    const { account } = params
    this.logger.info(`Queueing notification for member `, account.getDebtor())

    try {
      const member = await this.memberRepository.one({
        dni: account.getDebtor().debtorDNI,
        "church.churchId": account.getChurchId(),
      })

      if (!member) {
        throw new MemberNotFound()
      }

      let title: string

      switch (member.getSettings().lang) {
        case "es":
          title = "Fue registrado un nuevo compromiso de pago a su nombre"
          break
        case "en":
          title = "A new payment agreement was registered in his name"
          break
        case "pt-BR":
          title = "Um novo compromisso de pagamento foi registrado em seu nome"
          break
        default:
          throw new Error("Unsupported language")
      }

      this.queueService.dispatch<NotificationRequest>(QueueName.NotifyFCMJob, {
        churchId: account.getChurchId(),
        memberId: [member.getMemberId()],
        title: title,
        body: account.getDescription(),
        data: {
          id: account.getAccountReceivableId(),
          type: NotificationsTopic.PAYMENT_COMMITMENT_DUE,
        },
      })

      this.logger.info(
        `Notification for payment commitment queued for member`,
        account.getDebtor()
      )
      return
    } catch (e: any) {
      this.logger.error(
        `Error finding member with DNI ${account.getDebtor().debtorDNI}: `,
        e
      )
      return
    }
  }
}
