import {
  AvailabilityAccount,
  ContributionRequest,
  FinancialConcept,
  OnlineContributions,
} from "../../domain"
import { AmountValue, IStorageService } from "../../../Shared/domain"
import { Member } from "../../../Church/domain"
import { IFinancialYearRepository } from "../../../ConsolidatedFinancial/domain"
import { FinancialMonthValidator } from "../../../ConsolidatedFinancial/applications"
import { IOnlineContributionsRepository } from "../../domain/interfaces"
import { Logger } from "../../../Shared/adapter"

export class RegisterContributionsOnline {
  private logger = Logger("RegisterContributionsOnline")

  constructor(
    private readonly contributionRepository: IOnlineContributionsRepository,
    private readonly storageService: IStorageService,
    private readonly financialYearRepository: IFinancialYearRepository
  ) {}

  async execute(
    contributionRequest: ContributionRequest,
    availabilityAccount: AvailabilityAccount,
    member: Member,
    financialConcept: FinancialConcept
  ) {
    this.logger.info(
      `RegisterContributionsOnline contributionRequest: ${JSON.stringify(contributionRequest)} member: ${member.getName()} financialConcept: ${financialConcept.getName()}`
    )

    await new FinancialMonthValidator(this.financialYearRepository).validate(
      member.getChurchId()
    )

    const voucher = await this.storageService.uploadFile(
      contributionRequest.bankTransferReceipt
    )

    const contribution: OnlineContributions = OnlineContributions.create(
      AmountValue.create(contributionRequest.amount),
      member,
      financialConcept,
      voucher,
      contributionRequest.observation,
      availabilityAccount
    )

    await this.contributionRepository.upsert(contribution)
  }
}
