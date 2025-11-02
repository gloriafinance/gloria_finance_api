import {
  AccountReceivable,
  AccountReceivableNotFound,
  AccountsReceivableStatus,
  ActionsPaymentCommitment,
  ConfirmOrDenyPaymentCommitmentRequest,
  IAccountsReceivableRepository,
} from "@/AccountsReceivable/domain"
import { GeneratePDFAdapter, Logger } from "@/Shared/adapter"
import { Church, IChurchRepository, IMinisterRepository } from "@/Church/domain"
import { FindChurchById, FindMinisterById } from "@/Church/applications"
import { IQueueService } from "@/Shared/domain"

export class ConfirmOrDenyPaymentCommitment {
  private logger = Logger(ConfirmOrDenyPaymentCommitment.name)
  private searchChurch: FindChurchById
  private searchMinister: FindMinisterById

  constructor(
    private readonly accountReceivableRepository: IAccountsReceivableRepository,
    private readonly pdfAdapter: GeneratePDFAdapter,
    private readonly churchRepository: IChurchRepository,
    private readonly ministerRepository: IMinisterRepository,
    private readonly queueService: IQueueService
  ) {
    this.searchChurch = new FindChurchById(this.churchRepository)
    this.searchMinister = new FindMinisterById(this.ministerRepository)
  }

  async execute(
    req: ConfirmOrDenyPaymentCommitmentRequest
  ): Promise<AccountReceivable> {
    this.logger.info(`Start Confirm Or Deny Payment Commitment`, req)

    const account = await this.accountReceivableRepository.one({
      token: req.token,
      status: AccountsReceivableStatus.PENDING_ACCEPTANCE,
    })

    if (!account) {
      this.logger.debug(`Account Receivable not found`)
      throw new AccountReceivableNotFound()
    }

    const church = await this.searchChurch.execute(account.getChurchId())

    const accepted = req.action === ActionsPaymentCommitment.ACCEPTED
    account.accountAccepted(accepted)

    this.logger.info(`Account Receivable found - Accepted?: ${accepted}`)

    if (accepted) {
      await this.generateContract(account, church)

      // new DispatchCreateFinancialRecord(this.queueService).execute({
      //   churchId: account.getChurchId(),
      //   date: DateBR(),
      //   createdBy: account.getCreatedBy(),
      //   financialRecordType: FinancialRecordType.INCOME,
      //   source: FinancialRecordSource.AUTO,
      //   status: FinancialRecordStatus.PENDING,
      //   amount: account.getAmountPending(),
      //   financialConcept: account.getFinancialConcept(),
      //   description: `Conta a Receber criada: ${account.getDescription()}`,
      //   reference: {
      //     entityId: account.getAccountReceivableId(),
      //     type: "AccountReceivable",
      //   },
      // })
    }

    await this.accountReceivableRepository.upsert(account)

    this.logger.info(`Confirm Or Deny Payment Commitment finish`)

    return account
  }

  private async generateContract(
    account: AccountReceivable,
    church: Church
  ): Promise<void> {
    const minister = await this.searchMinister.execute(church.getMinisterId())

    const contract = await this.pdfAdapter
      .htmlTemplate("payment_commitment_contract", {
        symbol: "R$",
        amount: account.getAmountPending(),
        installments: account.getInstallments(),
        concept: account.getDescription(),
        dueDate: account.getDueDate(),
        token: account.getToken(),
        day: new Date().getDay(),
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        debtor: {
          name: account.getDebtor().name,
          email: account.getDebtor().email,
          dni: account.getDebtor().debtorDNI,
          address: account.getDebtor().address,
          phone: account.getDebtor().phone,
        },
        church: {
          name: church.getName(),
          address: church.getAddress(),
          legalRepresentative: {
            name: minister.getName(),
            role: minister.getMinisterType(),
            dni: minister.getDNI(),
          },
        },
      })
      .toPDF(true)

    account.setContract(contract)
  }
}
