import { DebtorType } from "./enums/DebtorType.enum"
import { AccountsReceivableStatus } from "./enums/AccountsReceivableStatus.enum"

import { IdentifyEntity } from "@/Shared/adapter"
import { DateBR } from "@/Shared/helpers"
import { ICreateAccountReceivable } from "./interfaces/CreateAccountReceivable.interface"

import { AmountValue, Installments, InstallmentsStatus } from "@/Shared/domain"
import { AggregateRoot } from "@abejarano/ts-mongodb-criteria"
import { AccountReceivableType } from "./enums/AccountReceivableType.enum"

type Debtor = {
  debtorType: DebtorType
  debtorDNI: string
  name: string
  phone: string
  email: string
  address: string
}

export class AccountReceivable extends AggregateRoot {
  protected amountTotal: number
  protected amountPaid: number
  private id?: string
  private type: AccountReceivableType
  private debtor: Debtor
  private accountReceivableId: string
  private churchId: string
  private description: string
  private amountPending: number
  private status: AccountsReceivableStatus
  private installments: Installments[]
  private token: string
  private createdAt: Date
  private updatedAt: Date
  private contract?: string

  static create(params: Partial<ICreateAccountReceivable>): AccountReceivable {
    const {
      debtor,
      churchId,
      description,
      amountPaid,
      amountPending,
      installments,
      type,
    } = params

    const accountReceivable: AccountReceivable = new AccountReceivable()
    accountReceivable.accountReceivableId =
      IdentifyEntity.get(`accountReceivable`)
    accountReceivable.churchId = churchId
    accountReceivable.description = description
    accountReceivable.type = type

    accountReceivable.amountPaid = amountPaid
    accountReceivable.amountPending = amountPending
    accountReceivable.status = AccountsReceivableStatus.PENDING_ACCEPTANCE

    let amountTotal: number = 0
    accountReceivable.installments = installments.map((i) => {
      amountTotal += Number(i.amount)

      return {
        ...i,
        dueDate: new Date(i.dueDate),
        installmentId: i.installmentId || IdentifyEntity.get(`installment`),
        status: InstallmentsStatus.PENDING,
      }
    })

    accountReceivable.amountTotal = amountTotal
    accountReceivable.amountPaid = 0
    accountReceivable.amountPending = accountReceivable.amountTotal

    accountReceivable.createdAt = DateBR()
    accountReceivable.updatedAt = DateBR()

    if (debtor) {
      accountReceivable.debtor = {
        phone: debtor.phone,
        debtorType: debtor.debtorType,
        debtorDNI: debtor.debtorDNI || IdentifyEntity.get(`debtor`),
        name: debtor.name,
        email: debtor.email,
        address: debtor.address,
      }
    }

    accountReceivable.token = Buffer.from(
      JSON.stringify(accountReceivable.toPrimitives())
    ).toString("base64")

    return accountReceivable
  }

  static fromPrimitives(params: any): AccountReceivable {
    const accountReceivable: AccountReceivable = new AccountReceivable()
    accountReceivable.id = params.id
    accountReceivable.installments = params.installments
    accountReceivable.accountReceivableId = params.accountReceivableId
    accountReceivable.churchId = params.churchId
    accountReceivable.description = params.description
    accountReceivable.amountTotal = params.amountTotal
    accountReceivable.amountPaid = params.amountPaid
    accountReceivable.amountPending = params.amountPending
    accountReceivable.status = params.status
    accountReceivable.createdAt = params.createdAt
    accountReceivable.updatedAt = params.updatedAt
    accountReceivable.debtor = params.debtor
    accountReceivable.token = params.token
    accountReceivable.type = params.type

    return accountReceivable
  }

  getId(): string {
    return this.id
  }

  getType(): AccountReceivableType {
    return this.type
  }

  getToken(): string {
    return this.token
  }

  getChurchId(): string {
    return this.churchId
  }

  getInstallment(installmentId: string): Installments {
    return this.installments.find((i) => i.installmentId === installmentId)
  }

  getInstallments(): Installments[] {
    return this.installments
  }

  getDescription(): string {
    return this.description
  }

  getDebtor(): Debtor {
    return this.debtor
  }

  updateAmount(amountPaid: AmountValue) {
    this.amountPaid += amountPaid.getValue()
    this.amountPending -= amountPaid.getValue()

    if (this.amountPending === 0) {
      this.status = AccountsReceivableStatus.PAID
    }

    this.updatedAt = DateBR()
  }

  getAmountPending() {
    return this.amountPending
  }

  getStatus() {
    return this.status
  }

  getDueDate(): Date {
    return this.installments[this.installments.length - 1].dueDate
  }

  accountAccepted(isAccepted: boolean) {
    isAccepted
      ? (this.status = AccountsReceivableStatus.PENDING)
      : (this.status = AccountsReceivableStatus.DENIED)
    this.updatedAt = DateBR()
  }

  setContract(contract: string) {
    this.contract = contract
  }

  getContract(): string {
    return this.contract
  }

  toPrimitives() {
    return {
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      debtor: {
        ...this.debtor,
      },
      accountReceivableId: this.accountReceivableId,
      churchId: this.churchId,
      description: this.description,
      amountTotal: this.amountTotal,
      amountPaid: this.amountPaid,
      amountPending: this.amountPending,
      installments: this.installments,
      token: this.token,
      contract: this.contract,
      type: this.type,
    }
  }
}
