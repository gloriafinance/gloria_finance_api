import {
  AccountReceivable,
  type AccountReceivableRequest,
  type IAccountsReceivableRepository,
} from "@/AccountsReceivable/domain"
import { Logger } from "@/Shared/adapter"
import { SendMailPaymentCommitment } from "@/SendMail/applications"
import { GenericException } from "@/Shared/domain"
import type { IFinancialConceptRepository } from "@/Financial/domain/interfaces"

export class CreateAccountReceivable {
  private logger = Logger(CreateAccountReceivable.name)

  constructor(
    private readonly accountReceivableRepository: IAccountsReceivableRepository,
    private readonly financialConceptRepository: IFinancialConceptRepository,
    private readonly sendMailPaymentCommitment: SendMailPaymentCommitment
  ) {}

  async execute(
    requestAccountReceivable: AccountReceivableRequest
  ): Promise<AccountReceivable> {
    this.logger.info(
      `Start Create Account Receivable`,
      requestAccountReceivable
    )

    const financialConcept = await this.financialConceptRepository.one({
      financialConceptId: requestAccountReceivable.financialConceptId,
    })

    if (!financialConcept) {
      throw new GenericException("Financial Concept not found")
    }

    const account = AccountReceivable.create({
      ...requestAccountReceivable,
      churchId: requestAccountReceivable.church.getChurchId(),
      financialConcept,
    })

    account.accountAccepted(true)

    // switch (requestAccountReceivable.type) {
    //   case AccountReceivableType.CONTRIBUTION:
    //     account.accountAccepted(true)
    //     break
    //   default:
    //     //TODO refactor symbol
    //     this.sendMailPaymentCommitment.execute({
    //       symbol: "R$",
    //       amount: account.getAmountPending(),
    //       installments: account.getInstallments(),
    //       concept: account.getDescription(),
    //       dueDate: account.getDueDate(),
    //       token: account.getToken(),
    //       debtor: {
    //         name: account.getDebtor().name,
    //         email: account.getDebtor().email,
    //         dni: account.getDebtor().debtorDNI,
    //       },
    //       church: {
    //         name: requestAccountReceivable.church.getName(),
    //         legalRepresentative: {
    //           name: "",
    //           role: "",
    //         },
    //       },
    //     })
    // }

    await this.accountReceivableRepository.upsert(account)

    this.logger.info(`CreateAccountReceivable finish`)

    return account
  }
}
