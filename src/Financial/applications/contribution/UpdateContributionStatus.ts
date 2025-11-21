import {
  ConceptType,
  ContributionNotFound,
  FinancialRecordSource,
  FinancialRecordStatus,
  FinancialRecordType,
  OnlineContributions,
  OnlineContributionsStatus,
  TypeOperationMoney,
} from "../../domain"
import { IOnlineContributionsRepository } from "../../domain/interfaces"
import { Logger } from "../../../Shared/adapter"
import { AmountValue, IQueueService } from "../../../Shared/domain"
import { DispatchCreateFinancialRecord } from "@/Financial/applications/dispatchers/DispatchCreateFinancialRecord"
import { DateBR } from "../../../Shared/helpers"
import { DispatchUpdateAvailabilityAccountBalance } from "@/Financial/applications/dispatchers/DispatchUpdateAvailabilityAccountBalance"
import { PayAccountReceivable } from "@/AccountsReceivable/applications"
import {
  IAvailabilityAccountRepository,
  IFinancialRecordRepository,
} from "@/Financial/domain/interfaces"
import { IAccountsReceivableRepository } from "@/AccountsReceivable/domain"

export class UpdateContributionStatus {
  private logger = Logger("UpdateContributionStatus")

  constructor(
    private readonly contributionRepository: IOnlineContributionsRepository,
    private readonly queueService: IQueueService,
    private readonly financialRecordRepository: IFinancialRecordRepository,
    private readonly availabilityAccountRepository: IAvailabilityAccountRepository,
    private readonly accountReceivableRepository: IAccountsReceivableRepository
  ) {}

  async execute(
    contributionId: string,
    status: OnlineContributionsStatus,
    createdBy: string
  ): Promise<void> {
    this.logger.info(
      `UpdateContributionStatus contributionId: ${contributionId}, status: ${status}`
    )

    const contribution: OnlineContributions =
      await this.contributionRepository.findById(contributionId)

    if (!contribution) {
      this.logger.info(`Contribution with id ${contributionId} not found`)
      throw new ContributionNotFound()
    }

    contribution.updateStatus(status)
    await this.contributionRepository.upsert(contribution)

    this.logger.info(`Contribution with id ${contributionId} updated`)

    if (contribution.getStatus() !== OnlineContributionsStatus.PROCESSED) {
      return
    }

    const concept = contribution.getFinancialConcept()
    const operationType =
      concept.getType() === ConceptType.INCOME
        ? TypeOperationMoney.MONEY_IN
        : TypeOperationMoney.MONEY_OUT

    new DispatchUpdateAvailabilityAccountBalance(this.queueService).execute({
      availabilityAccount: contribution.getAvailabilityAccount(),
      operationType,
      concept: concept.getName(),
      amount: contribution.getAmount(),
    })

    new DispatchCreateFinancialRecord(this.queueService).execute({
      financialConcept: concept,
      amount: contribution.getAmount(),
      churchId: contribution.getMember().getChurchId(),
      date: DateBR(),
      createdBy,
      financialRecordType: FinancialRecordType.INCOME,
      source: FinancialRecordSource.AUTO,
      status: FinancialRecordStatus.RECONCILED,
      availabilityAccount: contribution.getAvailabilityAccount(),
      voucher: contribution.getBankTransferReceipt(),
      description: concept.getName(),
    })

    if (
      contribution.getAccountReceivableId() &&
      contribution.getInstallmentId()
    ) {
      await new PayAccountReceivable(
        this.financialRecordRepository,
        this.availabilityAccountRepository,
        this.accountReceivableRepository,
        this.queueService
      ).execute({
        accountReceivableId: contribution.getAccountReceivableId(),
        installmentId: contribution.getInstallmentId(),
        installmentIds: [contribution.getInstallmentId()],
        financialTransactionId: contribution.getBankTransferReceipt(),
        availabilityAccountId: contribution
          .getAvailabilityAccount()
          .getAvailabilityAccountId(),
        churchId: contribution.getMember().getChurchId(),
        amount: AmountValue.create(contribution.getAmount()),
        voucher: contribution.getBankTransferReceipt(),
        concept: concept.getName(),
        createdBy: createdBy,
      })
    }
  }
}
