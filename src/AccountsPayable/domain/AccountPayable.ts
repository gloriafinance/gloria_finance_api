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
import { InvalidInstallmentsConfiguration } from "./exceptions/InvalidInstallmentsConfiguration"

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
  private taxes: AccountPayableTax[] = []
  private taxAmountTotal: number = 0
  private taxMetadata: AccountPayableTaxMetadata
  private createdAt: Date
  private updatedAt: Date

  static create(params: Partial<ICreateAccountPayable>): AccountPayable {
    const {
      supplier,
      churchId,
      description,
      amountPaid,
      installments,
      taxes,
      taxMetadata,
    } = params

    const accountPayable: AccountPayable = new AccountPayable()
    accountPayable.accountPayableId = IdentifyEntity.get(`accountPayable`)
    accountPayable.churchId = churchId
    accountPayable.description = description

    accountPayable.amountPaid = amountPaid
    accountPayable.status = AccountPayableStatus.PENDING

    const normalizedInstallments = Array.isArray(installments)
      ? installments
      : []
    const hasInstallments = normalizedInstallments.length > 0

    let installmentsTotal: number = 0
    if (hasInstallments) {
      accountPayable.installments = normalizedInstallments.map((i) => {
        const normalizedAmount = Number(Number(i.amount).toFixed(2))
        installmentsTotal += normalizedAmount

        return {
          ...i,
          amount: normalizedAmount,
          dueDate: new Date(i.dueDate),
          installmentId: i.installmentId || IdentifyEntity.get(`installment`),
          status: InstallmentsStatus.PENDING,
        }
      })
    } else {
      accountPayable.installments = []
    }

    const declaredAmount =
      params.amountTotal !== undefined ? Number(params.amountTotal) : undefined

    if (declaredAmount !== undefined && !Number.isFinite(declaredAmount)) {
      throw new InvalidInstallmentsConfiguration(
        "Informe um valor total numérico da nota fiscal."
      )
    }

    if (!hasInstallments) {
      if (declaredAmount === undefined) {
        throw new InvalidInstallmentsConfiguration(
          "Para notas fiscais registradas individualmente (cenário B), informe o valor total da NF em amountTotal e não envie parcelas."
        )
      }
    } else if (declaredAmount !== undefined) {
      const declaredRounded = Number(declaredAmount.toFixed(2))
      const installmentsRounded = Number(installmentsTotal.toFixed(2))
      const difference = Math.abs(declaredRounded - installmentsRounded)

      if (difference > 0.01) {
        throw new InvalidInstallmentsConfiguration(
          "A soma das parcelas (cenário A) deve coincidir com o valor total informado da NF. Ajuste os valores ou cadastre cada NF individualmente (cenário B). Diferença máxima permitida: R$ 0,01."
        )
      }
    }

    const normalizedTotal = hasInstallments
      ? declaredAmount !== undefined
        ? declaredAmount
        : installmentsTotal
      : (declaredAmount as number)

    accountPayable.amountTotal = Number(normalizedTotal.toFixed(2))
    accountPayable.amountPaid = 0
    accountPayable.amountPending = accountPayable.amountTotal

    const taxesInput = Array.isArray(taxes) ? taxes : []
    const forceExempt = taxMetadata?.taxExempt === true
    const normalizedTaxes = forceExempt
      ? []
      : AccountPayable.normalizeTaxes(accountPayable.amountTotal, taxesInput)
    accountPayable.taxes = normalizedTaxes
    const taxTotal = normalizedTaxes.reduce((total, tax) => total + tax.amount, 0)
    accountPayable.taxAmountTotal = forceExempt
      ? 0
      : Number(taxTotal.toFixed(2))
    accountPayable.taxMetadata = AccountPayable.normalizeTaxMetadata(
      taxMetadata,
      normalizedTaxes.length > 0,
      forceExempt
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
    const persistedInstallments = Array.isArray(params.installments)
      ? params.installments.map((installment) => ({
          ...installment,
          amount: Number(Number(installment.amount).toFixed(2)),
        }))
      : []
    accountPayable.installments = persistedInstallments
    accountPayable.accountPayableId = params.accountPayableId
    accountPayable.churchId = params.churchId
    accountPayable.description = params.description
    accountPayable.amountTotal = Number(params.amountTotal ?? 0)
    accountPayable.amountPaid = Number(params.amountPaid ?? 0)
    accountPayable.amountPending = Number(params.amountPending ?? 0)
    accountPayable.status = params.status
    accountPayable.createdAt = params.createdAt
    accountPayable.updatedAt = params.updatedAt
    accountPayable.supplier = params.supplier
    const taxes = Array.isArray(params.taxes) ? params.taxes : []
    const forceExempt = params.taxMetadata?.taxExempt === true
    const normalizedTaxes = forceExempt
      ? []
      : taxes.map((tax) => ({
          taxType: tax.taxType,
          percentage: Number(tax.percentage),
          amount: Number(Number(tax.amount).toFixed(2)),
        }))
    accountPayable.taxes = normalizedTaxes
    const persistedTaxTotal = normalizedTaxes.reduce(
      (total, tax) => total + Number(tax.amount),
      0
    )
    const declaredTaxTotalRaw =
      params.taxAmountTotal !== undefined
        ? Number(params.taxAmountTotal)
        : persistedTaxTotal
    const declaredTaxTotal = Number.isFinite(declaredTaxTotalRaw)
      ? declaredTaxTotalRaw
      : persistedTaxTotal
    accountPayable.taxAmountTotal = forceExempt
      ? 0
      : Number(declaredTaxTotal.toFixed(2))
    accountPayable.taxMetadata = AccountPayable.normalizeTaxMetadata(
      params.taxMetadata,
      normalizedTaxes.length > 0,
      forceExempt
    )

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

    if (this.amountPending <= 0) {
      this.status = AccountPayableStatus.PAID
      this.amountPending = 0
    } else if (this.amountPending < this.amountTotal) {
      this.status = AccountPayableStatus.PARTIAL
    } else {
      this.status = AccountPayableStatus.PENDING
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

  getTaxes(): AccountPayableTax[] {
    return this.taxes
  }

  getTaxAmountTotal(): number {
    return this.taxAmountTotal
  }

  getTaxMetadata(): AccountPayableTaxMetadata {
    return this.taxMetadata
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
    if (!taxes.length) {
      return []
    }

    return taxes.map((tax) => {
      const rawPercentage = Number(tax.percentage)
      const percentage = Number.isFinite(rawPercentage) ? rawPercentage : 0
      const providedAmount =
        tax.amount !== undefined ? Number(tax.amount) : undefined
      const calculatedAmount =
        providedAmount !== undefined && !Number.isNaN(providedAmount)
          ? providedAmount
          : Number(((baseAmount * percentage) / 100).toFixed(2))

      return {
        taxType: tax.taxType,
        percentage,
        amount: Number(calculatedAmount.toFixed(2)),
      }
    })
  }

  private static normalizeTaxMetadata(
    metadata: AccountPayableTaxMetadata | undefined,
    hasTaxes: boolean,
    forceExempt: boolean = false
  ): AccountPayableTaxMetadata {
    const allowedStatuses: AccountPayableTaxStatus[] = [
      "TAXED",
      "EXEMPT",
      "SUBSTITUTION",
      "NOT_APPLICABLE",
    ]

    const normalizedStatus = metadata?.status
      ? (metadata.status.toString().toUpperCase() as AccountPayableTaxStatus)
      : undefined

    const defaultStatus: AccountPayableTaxStatus = hasTaxes
      ? "TAXED"
      : "EXEMPT"

    let status = normalizedStatus && allowedStatuses.includes(normalizedStatus)
      ? normalizedStatus
      : defaultStatus

    const explicitExemptFlag =
      metadata && typeof metadata.taxExempt === "boolean"
        ? metadata.taxExempt
        : undefined

    const taxExempt = forceExempt
      ? true
      : explicitExemptFlag !== undefined
        ? explicitExemptFlag
        : !hasTaxes

    if (taxExempt) {
      status = "EXEMPT"
    }

    return {
      status,
      taxExempt,
      exemptionReason: metadata?.exemptionReason?.trim() || undefined,
      cstCode: metadata?.cstCode?.trim() || undefined,
      cfop: metadata?.cfop?.trim() || undefined,
      observation: metadata?.observation?.trim() || undefined,
    }
  }

}
