import { FinancialConcept } from "./FinancialConcept"
import { AggregateRoot } from "@abejarano/ts-mongodb-criteria"
import { IdentifyEntity } from "@/Shared/adapter"
import { AccountType } from "./enums/AccountType.enum"
import { CreateFinanceRecord } from "@/Financial/domain/types/CreateFinanceRecord.type"
import {
  FinancialRecordSource,
  FinancialRecordStatus,
  FinancialRecordType,
} from "./enums/FinancialRecordType.enum"
import { DateBR, UTCStringToDateBR } from "@/Shared/helpers"

export class FinanceRecord extends AggregateRoot {
  private costCenter?: {
    costCenterId: string
    name: string
  }
  private id?: string
  private financialRecordId: string
  private financialConcept: FinancialConcept
  private churchId: string
  private amount: number
  private date: Date
  private type: FinancialRecordType
  private availabilityAccount?: {
    availabilityAccountId: string
    accountName: string
    accountType: AccountType
  }
  private voucher?: string
  private description?: string
  private reference?: {
    type: string
    entityId: string
  }
  private status: FinancialRecordStatus
  private source: FinancialRecordSource
  private createdBy: string
  private createdAt: Date
  private updatedAt: Date
  private clearedAt?: Date
  private reconciledAt?: Date

  static create(params: CreateFinanceRecord): FinanceRecord {
    const {
      financialConcept,
      churchId,
      amount,
      date,
      availabilityAccount,
      description,
      voucher,
      costCenter,
      type,
      status,
      source,
      createdBy,
      reference,
    } = params
    const financialRecord: FinanceRecord = new FinanceRecord()
    financialRecord.financialRecordId = IdentifyEntity.get(`financialRecord`)

    if (typeof financialConcept === "object") {
      financialRecord.financialConcept =
        FinancialConcept.fromPrimitives(financialConcept)
    } else {
      financialRecord.financialConcept = financialConcept
    }

    financialRecord.churchId = churchId

    financialRecord.amount =
      type === FinancialRecordType.REVERSAL
        ? -Math.abs(Number(amount))
        : Math.abs(Number(amount))

    financialRecord.date = date
    financialRecord.type = type

    if (availabilityAccount) {
      financialRecord.availabilityAccount = {
        availabilityAccountId: availabilityAccount.getAvailabilityAccountId(),
        accountName: availabilityAccount.getAccountName(),
        accountType: availabilityAccount.getType(),
      }
    }

    financialRecord.voucher = voucher
    financialRecord.description = description

    if (costCenter) {
      financialRecord.costCenter = {
        costCenterId: costCenter.getCostCenterId(),
        name: costCenter.getCostCenterName(),
      }
    }

    financialRecord.createdAt = DateBR()
    financialRecord.updatedAt = DateBR()
    financialRecord.source = source
    financialRecord.createdBy = createdBy
    financialRecord.reference = reference
    financialRecord.setStatus(status)

    return financialRecord
  }

  static fromPrimitives(plainData: any): FinanceRecord {
    const financialRecord: FinanceRecord = new FinanceRecord()
    financialRecord.id = plainData?.id
    financialRecord.financialRecordId = plainData.financialRecordId
    financialRecord.financialConcept = FinancialConcept.fromPrimitives(
      plainData.financialConcept
    )
    financialRecord.churchId = plainData.churchId
    financialRecord.amount = plainData.amount
    financialRecord.date = UTCStringToDateBR(plainData.date)
    financialRecord.type = plainData.type
    financialRecord.availabilityAccount = plainData.availabilityAccount
    financialRecord.voucher = plainData?.voucher
    financialRecord.description = plainData.description
    financialRecord.costCenter = plainData?.costCenter
    financialRecord.createdAt = UTCStringToDateBR(
      plainData.createdAt ?? plainData.date
    )
    financialRecord.updatedAt = UTCStringToDateBR(
      plainData.updatedAt ?? plainData.date
    )
    financialRecord.source = plainData.source
    financialRecord.createdBy = plainData.createdBy ?? ""
    financialRecord.status = plainData.status
    financialRecord.reference = plainData.reference ?? undefined
    financialRecord.clearedAt =
      plainData.clearedAt === undefined
        ? undefined
        : UTCStringToDateBR(plainData.clearedAt)
    financialRecord.reconciledAt =
      plainData.reconciledAt === undefined
        ? undefined
        : UTCStringToDateBR(plainData.reconciledAt)

    return financialRecord
  }

  getId(): string {
    return this.id
  }

  getFinancialRecordId(): string {
    return this.financialRecordId
  }

  getType(): FinancialRecordType {
    return this.type
  }

  getChurchId(): string {
    return this.churchId
  }

  getAmount(): number {
    return this.amount
  }

  getAvailabilityAccountId(): string {
    if (!this.availabilityAccount) {
      throw new Error("Availability account not defined")
    }
    return this.availabilityAccount.availabilityAccountId
  }

  getAvailabilityAccount():
    | {
        availabilityAccountId: string
        accountName: string
        accountType: AccountType
      }
    | undefined {
    return this.availabilityAccount
  }

  getDate() {
    return this.date
  }

  getCostCenterId(): string | undefined {
    return this.costCenter?.costCenterId
  }

  getCostCenter() {
    return this.costCenter
  }

  getFinancialConcept() {
    return this.financialConcept
  }

  setVoucher(voucher: string) {
    this.voucher = voucher
  }

  setStatus(status: FinancialRecordStatus) {
    if (this.status === status) {
      return
    }

    const previousStatus = this.status
    this.status = status
    this.applyStatusSideEffects(status, previousStatus)
  }

  getStatus(): FinancialRecordStatus {
    return this.status
  }

  update() {
    this.updatedAt = DateBR()
  }

  getClearedAt(): Date | undefined {
    return this.clearedAt
  }

  getReconciledAt(): Date | undefined {
    return this.reconciledAt
  }

  toPrimitives() {
    return {
      financialConcept: this.financialConcept?.toPrimitives(),
      financialRecordId: this.financialRecordId,
      churchId: this.churchId,
      amount: this.amount,
      date: this.date,
      type: this.type,
      availabilityAccount: this.availabilityAccount,
      voucher: this.voucher,
      description: this.description,
      costCenter: this.costCenter,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      source: this.source,
      createdBy: this.createdBy,
      reference: this.reference,
      clearedAt: this.clearedAt,
      reconciledAt: this.reconciledAt,
    }
  }

  private applyStatusSideEffects(
    newStatus: FinancialRecordStatus,
    previousStatus?: FinancialRecordStatus
  ) {
    const now = DateBR()

    if (
      newStatus === FinancialRecordStatus.CLEARED ||
      newStatus === FinancialRecordStatus.RECONCILED
    ) {
      this.clearedAt = this.clearedAt ?? now
    }

    if (
      newStatus === FinancialRecordStatus.RECONCILED &&
      previousStatus !== FinancialRecordStatus.RECONCILED
    ) {
      this.reconciledAt = now
    }
  }
}
