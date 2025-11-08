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
import { IQueueService } from "../../../Shared/domain"
import { DispatchCreateFinancialRecord } from "@/Financial/applications/dispatchers/DispatchCreateFinancialRecord"
import { DateBR } from "../../../Shared/helpers"
import { DispatchUpdateAvailabilityAccountBalance } from "@/Financial/applications/dispatchers/DispatchUpdateAvailabilityAccountBalance"

export class UpdateContributionStatus {
  private logger = Logger("UpdateContributionStatus")

  constructor(
    private readonly contributionRepository: IOnlineContributionsRepository,
    private readonly queueService: IQueueService
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
  }
}
