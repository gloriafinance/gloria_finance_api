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
import type {
  IFinancialConceptRepository,
  IOnlineContributionsRepository,
} from "../../domain/interfaces"
import { Logger } from "@/Shared/adapter"
import { AmountValue } from "@/Shared/domain"
import {
  DispatchCreateFinancialRecord,
  DispatchUpdateAvailabilityAccountBalance,
} from "@/Financial/applications"
import { PayAccountReceivable } from "@/AccountsReceivable/applications"
import type { IAvailabilityAccountRepository } from "@/Financial/domain/interfaces"
import type { IAccountsReceivableRepository } from "@/AccountsReceivable/domain"
import type { IQueueService } from "@/package/queue/domain"

export class UpdateContributionStatus {
  private logger = Logger(UpdateContributionStatus.name)

  constructor(
    private readonly financialConceptRepository: IFinancialConceptRepository,
    private readonly contributionRepository: IOnlineContributionsRepository,
    private readonly queueService: IQueueService,
    private readonly availabilityAccountRepository: IAvailabilityAccountRepository,
    private readonly accountReceivableRepository: IAccountsReceivableRepository
  ) {}

  async execute(params: {
    contributionId: string
    status: OnlineContributionsStatus
    createdBy: string
    symbol: string
  }): Promise<void> {
    const { contributionId, status, createdBy, symbol } = params

    this.logger.info(
      `UpdateContributionStatus contributionId: ${contributionId}, status: ${status}`
    )

    const contribution: OnlineContributions | null =
      await this.contributionRepository.one({ contributionId })

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

    if (
      contribution.getAccountReceivableId() &&
      contribution.getInstallmentId()
    ) {
      await new PayAccountReceivable(
        this.financialConceptRepository,
        this.availabilityAccountRepository,
        this.accountReceivableRepository,
        this.queueService
      ).execute({
        accountReceivableId: contribution.getAccountReceivableId()!,
        installmentId: contribution.getInstallmentId()!,
        installmentIds: [contribution.getInstallmentId()!],
        financialTransactionId: contribution.getBankTransferReceipt(),
        availabilityAccountId: contribution
          .getAvailabilityAccount()
          .getAvailabilityAccountId(),
        churchId: contribution.getMember().getChurchId(),
        amount: AmountValue.create(contribution.getAmount()),
        voucher: contribution.getBankTransferReceipt(),
        concept: concept.getName(),
        createdBy: createdBy,
        symbol,
      })

      return
    }

    await new DispatchCreateFinancialRecord(this.queueService).execute({
      financialConcept: concept,
      amount: contribution.getAmount(),
      churchId: contribution.getChurchId(),
      date: contribution.getPaidAt(),
      createdBy,
      financialRecordType: FinancialRecordType.INCOME,
      source: FinancialRecordSource.AUTO,
      status: FinancialRecordStatus.CLEARED,
      availabilityAccount: contribution.getAvailabilityAccount(),
      voucher: contribution.getBankTransferReceipt(),
      description: `${concept.getName()}: ${contribution.getMember().getName()}`,
    })
  }
}
