import { AggregateRoot } from "../../Shared/domain"
import {
  AccountType,
  AvailabilityAccount,
  CostCenter,
} from "../../Financial/domain"
import { IdentifyEntity } from "../../Shared/adapter"

export class Purchase extends AggregateRoot {
  private id?: string
  private purchaseId: string
  private financialConceptId: string
  private churchId: string
  private purchaseDate: Date
  private total: number
  private tax: number
  private description: string
  private invoiceFile: string
  private availabilityAccount: {
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

  static create(
    financialConceptId: string,
    churchId: string,
    purchaseDate: Date,
    total: number,
    tax: number,
    description: string,
    invoice: string,
    availabilityAccount: AvailabilityAccount,
    costCenter: CostCenter,
    items: Array<{
      quantity: number
      price: number
      name: string
    }>
  ): Purchase {
    const p: Purchase = new Purchase()

    p.purchaseId = IdentifyEntity.get()
    p.financialConceptId = financialConceptId
    p.churchId = churchId
    p.purchaseDate = purchaseDate
    p.total = total
    p.tax = tax
    p.description = description
    p.invoiceFile = invoice
    p.availabilityAccount = {
      accountName: availabilityAccount.getAccountName(),
      accountType: availabilityAccount.getType(),
    }
    p.items = items
    p.costCenter = {
      costCenterId: costCenter.getCostCenterId(),
      name: costCenter.getCostCenterName(),
    }

    return p
  }

  static fromPrimitives(plainData: any): Purchase {
    const p: Purchase = new Purchase()

    p.purchaseId = plainData.purchaseId
    p.id = plainData.id
    p.financialConceptId = plainData.financialConceptId
    p.churchId = plainData.churchId
    p.purchaseDate = plainData.purchaseDate
    p.total = plainData.total
    p.tax = plainData.tax
    p.description = plainData.description
    p.invoiceFile = plainData.invoiceFile
    p.availabilityAccount = plainData.availabilityAccount
    p.items = plainData.items
    p.costCenter = plainData.costCenter

    return p
  }

  getId(): string {
    return this.id
  }

  toPrimitives() {
    return {
      purchaseId: this.purchaseId,
      financialConceptId: this.financialConceptId,
      churchId: this.churchId,
      purchaseDate: this.purchaseDate,
      total: this.total,
      tax: this.tax,
      description: this.description,
      invoice: this.invoiceFile,
      availabilityAccount: this.availabilityAccount,
      items: this.items,
      costCenter: this.costCenter,
    }
  }
}
