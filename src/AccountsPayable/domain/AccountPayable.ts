import { AmountValue, Installments, InstallmentsStatus } from "@/Shared/domain"
import { DateBR } from "@/Shared/helpers"
import { IdentifyEntity } from "@/Shared/adapter"
import { AccountPayableStatus } from "./enums/AccountPayableStatus"
import { SupplierType } from "./enums/SupplierType"
import { ICreateAccountPayable } from "./interfaces/CreateAccountPayable.interface"
import { AggregateRoot } from "@abejarano/ts-mongodb-criteria"

export class AccountPayable extends AggregateRoot {
  protected amountTotal: number
  protected amountPaid: number
  private id?: string
  private supplier: {
    supplierId: string
    supplierType: SupplierType
    supplierDNI: string
    name: string
    phone: string
  }
  private accountPayableId: string
  private churchId: string
  private description: string
  private amountPending: number
  private status: AccountPayableStatus
  private installments: Installments[]
  private createdAt: Date
  private updatedAt: Date

  static create(params: Partial<ICreateAccountPayable>): AccountPayable {
    const { supplier, churchId, description, amountPaid, installments } = params

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
        status: InstallmentsStatus.PENDING,
      }
    })

    accountPayable.amountTotal = amountTotal
    accountPayable.amountPaid = 0
    accountPayable.amountPending = accountPayable.amountTotal

    accountPayable.createdAt = DateBR()
    accountPayable.updatedAt = DateBR()

    accountPayable.supplier = {
      supplierId: supplier.supplierId,
      supplierType: supplier.supplierType,
      supplierDNI: supplier.supplierDNI,
      name: supplier.name,
      phone: supplier.phone,
    }

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
    accountPayable.supplier = params.supplier

    return accountPayable
  }

  getId(): string {
    return this.id
  }

  getInstallment(installmentId: string): Installments {
    return this.installments.find((i) => i.installmentId === installmentId)
  }

  updateAmount(amountPaid: AmountValue) {
    this.amountPaid += amountPaid.getValue()
    this.amountPending -= amountPaid.getValue()

    if (this.amountPending === 0) {
      this.status = AccountPayableStatus.PAID
    }

    this.updatedAt = DateBR()
  }

  getAmountPending() {
    return this.amountPending
  }

  getStatus() {
    return this.status
  }

  getChurchId() {
    return this.churchId
  }

  toPrimitives() {
    return {
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      supplier: this.supplier,
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
