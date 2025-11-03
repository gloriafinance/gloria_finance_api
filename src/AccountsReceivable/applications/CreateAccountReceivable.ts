import {
  AccountReceivable,
  AccountReceivableRequest,
  AccountReceivableType,
  IAccountsReceivableRepository,
} from "@/AccountsReceivable/domain"
import { Logger } from "@/Shared/adapter"
import { SendMailPaymentCommitment } from "@/SendMail/applications"

export class CreateAccountReceivable {
  private logger = Logger(CreateAccountReceivable.name)

  constructor(
    private readonly accountReceivableRepository: IAccountsReceivableRepository,
    private readonly sendMailPaymentCommitment: SendMailPaymentCommitment
  ) {}

  async execute(
    requestAccountReceivable: AccountReceivableRequest
  ): Promise<void> {
    this.logger.info(
      `Start Create Account Receivable`,
      requestAccountReceivable
    )

    const account = AccountReceivable.create(requestAccountReceivable)

    switch (requestAccountReceivable.type) {
      case AccountReceivableType.CONTRIBUTION:
        account.accountAccepted(true)
        break
      default:
        //TODO refactor symbol
        this.sendMailPaymentCommitment.execute({
          symbol: "R$",
          amount: account.getAmountPending(),
          installments: account.getInstallments(),
          concept: account.getDescription(),
          dueDate: account.getDueDate(),
          token: account.getToken(),
          debtor: {
            name: account.getDebtor().name,
            email: account.getDebtor().email,
            dni: account.getDebtor().debtorDNI,
          },
          church: {
            name: requestAccountReceivable.church.getName(),
            legalRepresentative: {
              name: "",
              role: "",
            },
          },
        })
    }

    await this.accountReceivableRepository.upsert(account)

    this.logger.info(`CreateAccountReceivable finish`)
  }
}
