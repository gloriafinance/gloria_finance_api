import {
  ContributionNotFound,
  FinancialRecordSource,
  FinancialRecordStatus,
  FinancialRecordType,
  OnlineContributions,
  OnlineContributionsStatus,
} from "../../domain"
import type {
  IFinancialConceptRepository,
  IOnlineContributionsRepository,
} from "../../domain/interfaces"
import { Logger } from "@/Shared/adapter"
import { AmountValue } from "@/Shared/domain"
import { DispatchCreateFinancialRecord } from "@/Financial/applications"
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
    availabilityAccountId: string
  }): Promise<void> {
    const { contributionId, status, createdBy, symbol, availabilityAccountId } =
      params

    this.logger.info(
      `UpdateContributionStatus contributionId: ${contributionId}, status: ${status}`
    )

    const contribution: OnlineContributions | null =
      await this.contributionRepository.one({ contributionId })

    if (!contribution) {
      this.logger.info(`Contribution with id ${contributionId} not found`)
      throw new ContributionNotFound()
    }

    if (status === OnlineContributionsStatus.PROCESSED) {
      const availabilityAccount = await this.availabilityAccountRepository.one({
        availabilityAccountId,
      })

      if (!availabilityAccount) {
        throw new Error(
          `Availability account ${availabilityAccountId} not found`
        )
      }

      contribution.setAvailabilityAccount(availabilityAccount)
    }

    contribution.updateStatus(status)
    await this.contributionRepository.upsert(contribution)

    this.logger.info(`Contribution with id ${contributionId} updated`)

    if (contribution.getStatus() !== OnlineContributionsStatus.PROCESSED) {
      return
    }

    if (
      contribution.getAccountReceivableId() &&
      contribution.getInstallmentId()
    ) {
      const concept = contribution.getFinancialConcept()
      const availabilityAccount = contribution.getAvailabilityAccount()

      if (!availabilityAccount) {
        throw new Error(
          `Contribution ${contributionId} does not have an availability account`
        )
      }

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
        availabilityAccountId: availabilityAccount.getAvailabilityAccountId(),
        churchId: contribution.getMember().getChurchId(),
        amount: AmountValue.create(contribution.getAmount()),
        voucher: contribution.getBankTransferReceipt(),
        concept: concept.getName(),
        createdBy: createdBy,
        symbol,
      })

      return
    }

    const concept = contribution.getFinancialConcept()
    const availabilityAccount = contribution.getAvailabilityAccount()

    if (!availabilityAccount) {
      throw new Error(
        `Contribution ${contributionId} does not have an availability account`
      )
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
      availabilityAccount,
      voucher: contribution.getBankTransferReceipt(),
      description: `${concept.getName()}: ${contribution.getMember().getName()}`,
    })
  }
}
