import { Logger } from "@/Shared/adapter"
import { Installments, IQueueService, QueueName } from "@/Shared/domain"
import { TemplateEmail } from "@/SendMail/enum/templateEmail.enum"

export class SendMailPaymentCommitment {
  private logger = Logger(SendMailPaymentCommitment.name)

  constructor(private readonly queueService: IQueueService) {}

  execute(params: {
    symbol: string
    amount: number
    installments: Installments[]
    concept: string
    dueDate: Date
    token: string
    debtor: {
      name: string
      email: string
      dni: string
    }
    church: {
      name: string
      legalRepresentative: {
        name: string
        role: string
      }
    }
  }) {
    this.logger.info(`Start Send Mail Payment Commitment`, params)

    this.queueService.dispatch(QueueName.SendMailJob, {
      to: params.debtor.email,
      subject: "Compromisso de Pagamento",
      template: TemplateEmail.PaymentCommitment,
      clientName: params.debtor.name,
      context: {
        ...params,
      },
    })
  }
}
