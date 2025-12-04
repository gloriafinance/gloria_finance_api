import {
  AvailabilityAccount,
  FinancialConcept,
  OnlineContributions,
} from "../../domain"
import { AmountValue, IStorageService } from "@/Shared/domain"
import { Member } from "@/Church/domain"
import { IFinancialYearRepository } from "@/ConsolidatedFinancial/domain"
import { FinancialMonthValidator } from "@/ConsolidatedFinancial/applications"
import { IOnlineContributionsRepository } from "../../domain/interfaces"
import { Logger } from "@/Shared/adapter"
import { DateBR, StringToDate } from "@/Shared/helpers"

export class RegisterContributionsOnline {
  private logger = Logger("RegisterContributionsOnline")

  constructor(
    private readonly contributionRepository: IOnlineContributionsRepository,
    private readonly storageService: IStorageService,
    private readonly financialYearRepository: IFinancialYearRepository
  ) {}

  async execute(
    params: {
      amount: number
      observation?: string
      paidAt: string
      bankTransferReceipt: any
      installmentId?: string
      accountReceivableId?: string
    },
    availabilityAccount: AvailabilityAccount,
    member: Member,
    financialConcept: FinancialConcept
  ) {
    this.logger.info(
      `RegisterContributionsOnline contributionRequest: ${JSON.stringify(params)} member: ${member.getName()} financialConcept: ${financialConcept.getName()}`
    )

    const {
      bankTransferReceipt,
      paidAt,
      accountReceivableId,
      installmentId,
      observation,
      amount,
    } = params
    const date = DateBR()

    await new FinancialMonthValidator(this.financialYearRepository).validate({
      churchId: member.getChurchId(),
      month: new Date(paidAt).getUTCMonth() + 1,
      year: date.getFullYear(),
    })

    let voucher = bankTransferReceipt
    if (voucher && typeof voucher !== "string") {
      voucher = await this.storageService.uploadFile(voucher)
    }

    const voucherPath = (voucher as string) || ""

    const contribution: OnlineContributions = OnlineContributions.create(
      AmountValue.create(amount),
      member,
      financialConcept,
      voucherPath,
      observation,
      availabilityAccount,
      StringToDate(paidAt),
      {
        accountReceivableId: accountReceivableId,
        installmentId: installmentId,
      }
    )

    await this.contributionRepository.upsert(contribution)
  }
}
