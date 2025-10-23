import { AmountValue, Installments, InstallmentsStatus } from "@/Shared/domain"
import { DateBR } from "@/Shared/helpers"
import { IdentifyEntity } from "@/Shared/adapter"
import { AccountPayableStatus } from "./enums/AccountPayableStatus"
import { SupplierType } from "./enums/SupplierType"
import { ICreateAccountPayable } from "./interfaces/CreateAccountPayable.interface"
import { AggregateRoot } from "@abejarano/ts-mongodb-criteria"
import {
  AccountPayableTax,
  AccountPayableTaxInput,
  AccountPayableTaxMetadata,
  AccountPayableTaxStatus,
} from "./types/AccountPayableTax.type"

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
  private taxes: AccountPayableTax[]
  private taxAmountTotal: number
  private taxMetadata?: AccountPayableTaxMetadata
  private createdAt: Date
  private updatedAt: Date

  static create(params: Partial<ICreateAccountPayable>): AccountPayable {
    const {
      supplier,
      churchId,
      description,
      amountPaid,
      installments,
      taxes = [],
      taxMetadata,
    } = params

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

    const normalizedTaxes = AccountPayable.normalizeTaxes(
      amountTotal,
      taxes
    )
    accountPayable.taxes = normalizedTaxes
    accountPayable.taxAmountTotal = normalizedTaxes.reduce(
      (acc, tax) => acc + tax.amount,
      0
    )
    accountPayable.taxMetadata = AccountPayable.normalizeTaxMetadata(
      taxMetadata,
      normalizedTaxes.length > 0
    )

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
    const taxes = params.taxes || []
    accountPayable.taxes = taxes.map((tax) => ({
      taxType: tax.taxType,
      percentage: Number(tax.percentage),
      amount: Number(tax.amount),
    }))
    accountPayable.taxAmountTotal = Number(params.taxAmountTotal || 0)
    accountPayable.taxMetadata = AccountPayable.normalizeTaxMetadata(
      params.taxMetadata,
      taxes.length > 0
    )

    return accountPayable
  }

  getId(): string {
    return this.id
  }

  getInstallment(installmentId: string): Installments {
    return this.installments.find((i) => i.installmentId === installmentId)
  }

  getTaxes(): AccountPayableTax[] {
    return this.taxes
  }

  getTaxAmountTotal(): number {
    return this.taxAmountTotal
  }

  getTaxMetadata(): AccountPayableTaxMetadata | undefined {
    return this.taxMetadata
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
      taxes: this.taxes,
      taxAmountTotal: this.taxAmountTotal,
      taxMetadata: this.taxMetadata,
    }
  }

  private static normalizeTaxes(
    baseAmount: number,
    taxes: AccountPayableTaxInput[]
  ): AccountPayableTax[] {
    if (!taxes?.length) {
      return []
    }

    return taxes.map((tax) => {
      const percentage = Number(tax.percentage)
      const providedAmount =
        tax.amount !== undefined ? Number(tax.amount) : undefined
      const calculatedAmount =
        providedAmount !== undefined
          ? providedAmount
          : Number(((baseAmount * percentage) / 100).toFixed(2))

      return {
        taxType: tax.taxType,
        percentage,
        amount: calculatedAmount,
      }
    })
  }

  private static normalizeTaxMetadata(
    metadata: AccountPayableTaxMetadata | undefined,
    hasTaxes: boolean
  ): AccountPayableTaxMetadata | undefined {
    if (!metadata) {
      if (!hasTaxes) {
        return { status: "NOT_APPLICABLE" }
      }

      return undefined
    }

    const status = metadata.status
      ? (metadata.status.toUpperCase() as AccountPayableTaxStatus)
      : undefined
    const allowedStatuses: AccountPayableTaxStatus[] = [
      "TAXED",
      "EXEMPT",
      "SUBSTITUTION",
      "NOT_APPLICABLE",
    ]
    const normalizedStatus = status && allowedStatuses.includes(status)
      ? status
      : hasTaxes
        ? "TAXED"
        : "NOT_APPLICABLE"

    return {
      status: normalizedStatus,
      exemptionReason: metadata.exemptionReason?.trim() || undefined,
      cstCode: metadata.cstCode?.trim() || undefined,
      cfop: metadata.cfop?.trim() || undefined,
      observation: metadata.observation?.trim() || undefined,
    }
  }
}
