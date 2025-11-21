import {
  AvailabilityAccount,
  ContributionRequest,
  FinancialConcept,
  OnlineContributions,
} from "../../domain"
import { AmountValue, IStorageService } from "@/Shared/domain"
import { Member } from "@/Church/domain"
import { IFinancialYearRepository } from "@/ConsolidatedFinancial/domain"
import { FinancialMonthValidator } from "@/ConsolidatedFinancial/applications"
import { IOnlineContributionsRepository } from "../../domain/interfaces"
import { Logger } from "@/Shared/adapter"
import { DateBR } from "@/Shared/helpers"

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

    const date = DateBR()

    await new FinancialMonthValidator(this.financialYearRepository).validate({
      churchId: member.getChurchId(),
      month: date.getUTCMonth() + 1,
      year: date.getFullYear(),
    })

    let voucher = contributionRequest.bankTransferReceipt
    if (voucher && typeof voucher !== "string") {
      voucher = await this.storageService.uploadFile(voucher)
    }

    const voucherPath = (voucher as string) || ""

    const contribution: OnlineContributions = OnlineContributions.create(
      AmountValue.create(contributionRequest.amount),
      member,
      financialConcept,
      voucherPath,
      contributionRequest.observation,
      availabilityAccount,
      {
        accountReceivableId: contributionRequest.accountReceivableId,
        installmentId: contributionRequest.installmentId,
      }
    )

    await this.contributionRepository.upsert(contribution)
  }
}
