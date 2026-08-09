import { OnlineContributionsStatus } from "./enums/OnlineContributionsStatus.enum"
import { IdentifyEntity } from "@/Shared/adapter"
import { AvailabilityAccount, FinancialConcept } from "@/FinanceConfig/domain"
import { FinancialConceptDisable } from "./exceptions/FinancialConceptDisable.exception"
import { DateBR } from "@/Shared/helpers"
import { AggregateRoot } from "@abejarano/ts-mongodb-criteria"
import { AmountValue } from "@/Shared/domain"
import { ContributionMemberSnapshot } from "./ContributionMemberSnapshot"

export class OnlineContributions extends AggregateRoot {
  private churchId: string
  private member: ContributionMemberSnapshot
  private contributionId: string
  private status: OnlineContributionsStatus
  private financialConcept: FinancialConcept
  private amount: number
  private bankTransferReceipt: string
  private observation: string
  private createdAt: Date
  private availabilityAccount?: AvailabilityAccount
  private accountReceivableId?: string
  private installmentId?: string
  private paidAt: Date

  static create(params: {
    amount: AmountValue
    member: {
      getMemberId(): string
      getName(): string
      getChurch(): { churchId: string; name: string }
    }
    financialConcept: FinancialConcept
    bankTransferReceipt: string
    observation?: string
    availabilityAccount?: AvailabilityAccount
    paidAt: Date
    reference?: {
      accountReceivableId?: string
      installmentId?: string
    }
  }): OnlineContributions {
    const {
      member,
      availabilityAccount,
      amount,
      financialConcept,
      bankTransferReceipt,
      observation,
      paidAt,
      reference,
    } = params

    const contributions: OnlineContributions = new OnlineContributions()
    contributions.member = ContributionMemberSnapshot.fromMember(member)
    contributions.churchId = member.getChurch().churchId
    contributions.contributionId = IdentifyEntity.get(`contribution`)
    contributions.bankTransferReceipt = bankTransferReceipt

    contributions.status = OnlineContributionsStatus.PENDING_VERIFICATION
    contributions.amount = amount.getValue()
    contributions.createdAt = DateBR()
    contributions.financialConcept = financialConcept
    contributions.availabilityAccount = availabilityAccount
    contributions.paidAt = paidAt

    if (financialConcept.isDisable()) {
      throw new FinancialConceptDisable()
    }

    contributions.observation = observation ?? ""
    contributions.accountReceivableId = reference?.accountReceivableId
    contributions.installmentId = reference?.installmentId

    return contributions
  }

  static fromPrimitives(plainData: any): OnlineContributions {
    const contributions: OnlineContributions = new OnlineContributions()
    contributions.member = ContributionMemberSnapshot.fromPrimitives(
      plainData.member
    )
    contributions.contributionId = plainData.contributionId
    contributions.status = plainData.status
    contributions.amount = plainData.amount
    contributions.createdAt = new Date(plainData.createdAt)
    contributions.bankTransferReceipt = plainData.bankTransferReceipt
    contributions.churchId = plainData.churchId
    contributions.financialConcept = FinancialConcept.fromPrimitives(
      plainData.financialConcept
    )
    contributions.observation = plainData.observation
    contributions.availabilityAccount = plainData.availabilityAccount
      ? AvailabilityAccount.fromPrimitives(plainData.availabilityAccount)
      : undefined
    contributions.accountReceivableId = plainData.accountReceivableId
    contributions.installmentId = plainData.installmentId
    contributions.paidAt = new Date(plainData.paidAt)

    return contributions
  }

  setAvailabilityAccount(account: AvailabilityAccount) {
    this.availabilityAccount = account
  }

  updateStatus(status: OnlineContributionsStatus) {
    this.status = status
  }

  getChurchId() {
    return this.churchId
  }

  getAmount() {
    return this.amount
  }

  getStatus() {
    return this.status
  }

  getCreatedAt() {
    return this.createdAt
  }

  getMember(): ContributionMemberSnapshot {
    return this.member
  }

  getAvailabilityAccount(): AvailabilityAccount | undefined {
    return this.availabilityAccount
  }

  getAccountReceivableId(): string | undefined {
    return this.accountReceivableId
  }

  getInstallmentId(): string | undefined {
    return this.installmentId
  }

  getFinancialConcept() {
    return this.financialConcept
  }

  getBankTransferReceipt() {
    return this.bankTransferReceipt
  }

  getPaidAt() {
    return this.paidAt
  }

  toPrimitives() {
    return {
      contributionId: this.contributionId,
      member: this.member.toPrimitives(),
      status: this.status,
      amount: this.amount,
      createdAt: this.createdAt,
      bankTransferReceipt: this.bankTransferReceipt,
      churchId: this.churchId,
      observation: this.observation,
      financialConcept: this.financialConcept.toPrimitives(),
      availabilityAccount: this.availabilityAccount,
      accountReceivableId: this.accountReceivableId,
      installmentId: this.installmentId,
      paidAt: this.paidAt,
    }
  }
}
