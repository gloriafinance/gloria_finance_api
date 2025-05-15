import {
  AccountReceivable,
  AccountReceivableNotFound,
  ConfirmOrDenyPaymentCommitmentRequest,
  IAccountsReceivableRepository,
} from "@/AccountsReceivable/domain"
import { GeneratePDFAdapter, Logger } from "@/Shared/adapter"
import { Church } from "@/Church/domain"

export class ConfirmOrDenyPaymentCommitment {
  private logger = Logger(ConfirmOrDenyPaymentCommitment.name)

  constructor(
    private readonly accountReceivableRepository: IAccountsReceivableRepository,
    private readonly pdfAdapter: GeneratePDFAdapter
  ) {}

  async execute(
    req: ConfirmOrDenyPaymentCommitmentRequest
  ): Promise<AccountReceivable> {
    this.logger.info(`Start Confirm Or Deny Payment Commitment`, req)

    const account = await this.accountReceivableRepository.one({
      token: req.token,
    })

    if (!account) {
      this.logger.debug(`Account Receivable not found`)
      throw new AccountReceivableNotFound()
    }

    const accepted = req.status === "ACCEPTED"
    account.accountAccepted(accepted)

    if (accepted) {
      await this.generateContract(account, req.church)
    }

    await this.accountReceivableRepository.upsert(account)

    this.logger.info(`Confirm Or Deny Payment Commitment finish`)

    return account
  }

  private async generateContract(
    account: AccountReceivable,
    church: Church
  ): Promise<void> {
    const contract = await this.pdfAdapter
      .htmlTemplate("payment_commitment_contract", {
        symbol: "R$",
        amount: account.getAmountPending(),
        installments: account.getInstallments(),
        concept: account.getDescription(),
        dueDate: account.getDueDate(),
        token: account.getToken(),
        debtor: {
          name: account.getDebtor().name,
          email: account.getDebtor().email,
        },
        church: {
          name: church.getName(),
        },
      })
      .toPDF(true)

    account.setContract(contract)
  }
}
