import { OnlineContributionsStatus } from "./enums/OnlineContributionsStatus.enum"
import { IdentifyEntity } from "@/Shared/adapter"
import { Member } from "@/Church/domain"
import { AvailabilityAccount, FinancialConcept } from "@/FinanceConfig/domain"
import { FinancialConceptDisable } from "./exceptions/FinancialConceptDisable.exception"
import { DateBR } from "@/Shared/helpers"
import { AggregateRoot } from "@abejarano/ts-mongodb-criteria"
import { AmountValue } from "@/Shared/domain"

export class OnlineContributions extends AggregateRoot {
  private id?: string
  private churchId: string
  private member: Member
  private contributionId: string
  private status: OnlineContributionsStatus
  private financialConcept: FinancialConcept
  private amount: number
  private bankTransferReceipt: string
  private observation: string
  private createdAt: Date
  private availabilityAccount: AvailabilityAccount
  private accountReceivableId?: string
  private installmentId?: string
  private paidAt: Date

  static create(
    amount: AmountValue,
    member: Member,
    financialConcept: FinancialConcept,
    bankTransferReceipt: string,
    observation: string = "",
    availabilityAccount: AvailabilityAccount,
    paidAt: Date,
    reference?: {
      accountReceivableId?: string
      installmentId?: string
    }
  ): OnlineContributions {
    const contributions: OnlineContributions = new OnlineContributions()
    contributions.member = member
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

    contributions.observation = observation
    contributions.accountReceivableId = reference?.accountReceivableId
    contributions.installmentId = reference?.installmentId

    return contributions
  }

  static override fromPrimitives(plainData: any): OnlineContributions {
    const contributions: OnlineContributions = new OnlineContributions()
    contributions.id = plainData.id
    contributions.member = Member.fromPrimitives(plainData.member)
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
    contributions.availabilityAccount = AvailabilityAccount.fromPrimitives(
      plainData.availabilityAccount
    )
    contributions.accountReceivableId = plainData.accountReceivableId
    contributions.installmentId = plainData.installmentId
    contributions.paidAt = new Date(plainData.paidAt)

    return contributions
  }

  updateStatus(status: OnlineContributionsStatus) {
    this.status = status
  }

  getContributionsId(): string {
    return this.contributionId
  }

  getId(): string {
    return this.id
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

  getMember(): Member {
    return this.member
  }

  getAvailabilityAccount(): AvailabilityAccount {
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
      member: this.member,
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
