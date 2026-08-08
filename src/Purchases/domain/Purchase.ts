import {
  AccountType,
  AvailabilityAccount,
  CostCenter,
} from "@/Financial/domain"
import { IdentifyEntity } from "@/Shared/adapter"
import { AggregateRoot } from "@abejarano/ts-mongodb-criteria"
import { DateBR } from "@/Shared/helpers"

export class Purchase extends AggregateRoot {
  private id?: string
  private purchaseId: string
  private churchId: string
  private purchaseDate: Date
  private total: number
  private tax: number
  private description: string
  private invoice: string
  private availabilityAccount?: {
    accountName: string
    accountType: AccountType
  }
  private items: Array<{
    quantity: number
    price: number
    name: string
  }>
  private costCenter: {
    costCenterId: string
    name: string
  }
  private createdAt: Date
  private createdBy?: string
  private paymentType: "cash" | "credit"
  private accountPayable: {
    accountPayableId: string
    amountPaid: number
    amountTotal: number
    installments: {
      installments: number
      installmentsPaid: number
    }
  }

  static create(
    churchId: string,
    purchaseDate: Date,
    total: number,
    tax: number,
    description: string,
    invoice: string,
    costCenter: CostCenter,
    items: Array<{
      quantity: number
      price: number
      name: string
    }>,
    createdBy: string,
    paymentType: "cash" | "credit",
    availabilityAccount?: AvailabilityAccount,
    accountPayable?: {
      accountPayableId: string
      amountPaid: number
      amountTotal: number
      installments: {
        installments: number
        installmentsPaid: number
      }
    }
  ): Purchase {
    const p: Purchase = new Purchase()

    p.purchaseId = IdentifyEntity.get(`purchase`)
    p.churchId = churchId
    p.purchaseDate = purchaseDate
    p.total = total
    p.tax = tax
    p.description = description
    p.invoice = invoice
    if (availabilityAccount) {
      p.availabilityAccount = {
        accountName: availabilityAccount.getAccountName(),
        accountType: availabilityAccount.getType(),
      }
    }

    if (accountPayable) {
      p.accountPayable = accountPayable
    }

    p.items = items
    p.costCenter = {
      costCenterId: costCenter.getCostCenterId(),
      name: costCenter.getCostCenterName(),
    }
    p.createdAt = DateBR()
    p.createdBy = createdBy
    p.paymentType = paymentType ?? "cash"

    return p
  }

  static fromPrimitives(plainData: any): Purchase {
    const p: Purchase = new Purchase()

    p.purchaseId = plainData.purchaseId
    p.id = plainData.id
    p.churchId = plainData.churchId
    p.purchaseDate = plainData.purchaseDate
    p.total = plainData.total
    p.tax = plainData.tax
    p.description = plainData.description
    p.invoice = plainData.invoice
    p.availabilityAccount = plainData.availabilityAccount || {
      accountName: "N/A",
      accountType: "N/A",
    }
    p.items = plainData.items
    p.costCenter = plainData.costCenter
    p.createdAt = plainData.createdAt || plainData.purchaseDate
    p.createdBy = plainData.createdBy || ""
    p.paymentType = plainData?.paymentType || "cash"
    p.accountPayable = plainData.accountPayable

    return p
  }

  getId(): string | undefined {
    return this.id
  }

  getPurchaseId() {
    return this.purchaseId
  }

  getInvoiceFile() {
    return this.invoice
  }

  setAccountPayable(params: {
    accountPayableId: string
    amountPaid: number
    amountTotal: number
    installments: {
      installments: number
      installmentsPaid: number
    }
  }) {
    this.accountPayable = params
  }

  toPrimitives() {
    return {
      purchaseId: this.purchaseId,
      churchId: this.churchId,
      purchaseDate: this.purchaseDate,
      total: this.total,
      tax: this.tax,
      description: this.description,
      invoice: this.invoice,
      availabilityAccount: this.availabilityAccount,
      items: this.items,
      costCenter: this.costCenter,
      createdAt: this.createdAt,
      createdBy: this.createdBy,
      paymentType: this.paymentType,
      accountPayable: this.accountPayable,
    }
  }
}
