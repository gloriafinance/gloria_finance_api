import { AggregateRoot, AmountValue } from "@/Shared/domain"
import { DateBR } from "@/Shared/helpers"
import { IdentifyEntity } from "@/Shared/adapter"
import { AccountPayableStatus } from "./enums/AccountPayableStatus"
import { ProviderType } from "./enums/ProviderType"
import { InstallmentStatus } from "./enums/InstallmentStatus"
import { Installment } from "./types/Installment.type"
import { ICreateAccountPayable } from "./interfaces/CreateAccountPayable.interface"

export class AccountPayable extends AggregateRoot {
  protected amountTotal: number
  protected amountPaid: number
  private id?: string
  private provider: {
    providerType: ProviderType
    providerDNI: string
    name: string
    phone: string
  }
  private accountPayableId: string
  private churchId: string
  private description: string
  private amountPending: number
  private status: AccountPayableStatus
  private installments: Installment[]
  private createdAt: Date
  private updatedAt: Date

  static create(params: Partial<ICreateAccountPayable>): AccountPayable {
    const { provider, churchId, description, amountPaid, installments } = params

    const accountPayable: AccountPayable = new AccountPayable()
    accountPayable.accountPayableId = IdentifyEntity.get(`accountPayable`)
    accountPayable.churchId = churchId
    accountPayable.description = description

    accountPayable.amountPaid = amountPaid
    accountPayable.status = AccountPayableStatus.PENDING

    let amountTotal: number = 0
    accountPayable.installments = installments.map((i) => {
      amountTotal += Number(i.amount)

      return {
        ...i,
        dueDate: new Date(i.dueDate),
        installmentId: i.installmentId || IdentifyEntity.get(`installment`),
        status: InstallmentStatus.PENDING,
      }
    })

    accountPayable.amountTotal = amountTotal
    accountPayable.amountPaid = 0
    accountPayable.amountPending = accountPayable.amountTotal

    accountPayable.createdAt = DateBR()
    accountPayable.updatedAt = DateBR()

    accountPayable.provider = provider

    return accountPayable
  }

  static fromPrimitives(params: any): AccountPayable {
    const accountPayable: AccountPayable = new AccountPayable()
    accountPayable.id = params.id
    accountPayable.installments = params.installments
    accountPayable.accountPayableId = params.accountPayableId
    accountPayable.churchId = params.churchId
    accountPayable.description = params.description
    accountPayable.amountTotal = params.amountTotal
    accountPayable.amountPaid = params.amountPaid
    accountPayable.amountPending = params.amountPending
    accountPayable.status = params.status
    accountPayable.createdAt = params.createdAt
    accountPayable.updatedAt = params.updatedAt
    accountPayable.provider = params.provider

    return accountPayable
  }

  getId(): string {
    return this.id
  }

  getInstallment(installmentId: string): Installment {
    return this.installments.find((i) => i.installmentId === installmentId)
  }

  updateAmount(amountPaid: AmountValue) {
    this.amountPaid += amountPaid.getValue()
    this.amountPending -= amountPaid.getValue()

    if (this.amountPending === 0) {
      this.status = AccountPayableStatus.PAID
    } else if (this.amountPaid > 0 && this.amountPending > 0) {
      this.status = AccountPayableStatus.PARTIAL
    }

    this.updatedAt = DateBR()
  }

  getAmountPending() {
    return this.amountPending
  }

  getStatus() {
    return this.status
  }

  toPrimitives() {
    return {
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      provider: {
        ...this.provider,
      },
      accountPayableId: this.accountPayableId,
      churchId: this.churchId,
      description: this.description,
      amountTotal: this.amountTotal,
      amountPaid: this.amountPaid,
      amountPending: this.amountPending,
      installments: this.installments,
    }
  }
}
