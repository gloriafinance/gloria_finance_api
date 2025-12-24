import { IMemberRepository } from "@/Church/domain"
import { IQueueService, QueueName } from "@/Shared/domain"
import { FindMemberById } from "@/Church/applications"
import { Logger } from "@/Shared/adapter"
import { NotificationRequest, NotificationsTopic } from "@/Notifications/domain"
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
      const member = await new FindMemberById(this.memberRepository).execute(
        account.getDebtor().debtorDNI
      )

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
        memberId: [account.getDebtor().debtorDNI],
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
    } catch (e) {
      this.logger.error(
        `Error finding member with ID ${account.getDebtor().debtorDNI}: `,
        e
      )
      return
    }
  }
}
