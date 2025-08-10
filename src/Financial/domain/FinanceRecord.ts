import { FinancialConcept } from "./FinancialConcept"
import { AggregateRoot } from "@/Shared/domain"
import { IdentifyEntity } from "@/Shared/adapter"
import { ConceptType } from "./enums/ConcepType.enum"
import { AvailabilityAccount } from "./AvailabilityAccount"
import { AccountType } from "./enums/AccountType.enum"
import { CostCenter } from "./CostCenter"
import { CreateFinanceRecord } from "@/Financial/domain/types/CreateFinanceRecord.type"

export class FinanceRecord extends AggregateRoot {
  private costCenter: {
    costCenterId: string
    name: string
  }
  private id?: string
  private financialRecordId: string
  private financialConcept: FinancialConcept
  private churchId: string
  private amount: number
  private date: Date
  private type: ConceptType
  private availabilityAccount: {
    availabilityAccountId: string
    accountName: string
    accountType: AccountType
  }
  private voucher?: string
  private description?: string

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
    } = params
    const financialRecord: FinanceRecord = new FinanceRecord()
    financialRecord.financialRecordId = IdentifyEntity.get(`financialRecord`)
    financialRecord.financialConcept = financialConcept
    financialRecord.churchId = churchId
    financialRecord.amount = Number(amount)
    financialRecord.date = date
    financialRecord.type = type
    financialRecord.availabilityAccount = {
      availabilityAccountId: availabilityAccount.getAvailabilityAccountId(),
      accountName: availabilityAccount.getAccountName(),
      accountType: availabilityAccount.getType(),
    }
    financialRecord.voucher = voucher
    financialRecord.description = description

    if (costCenter) {
      financialRecord.costCenter = {
        costCenterId: costCenter.getCostCenterId(),
        name: costCenter.getCostCenterName(),
      }
    }

    return financialRecord
  }

  static fromPrimitives(plainData: any): FinanceRecord {
    const financialRecord: FinanceRecord = new FinanceRecord()
    financialRecord.id = plainData?.id
    financialRecord.financialRecordId = plainData.financialRecordId
    financialRecord.financialConcept = plainData.financialConcept
    financialRecord.churchId = plainData.churchId
    financialRecord.amount = plainData.amount
    financialRecord.date = plainData.date
    financialRecord.type = plainData.type
    financialRecord.availabilityAccount = plainData.availabilityAccount
    financialRecord.voucher = plainData?.voucher
    financialRecord.description = plainData.description
    financialRecord.costCenter = plainData?.costCenter

    return financialRecord
  }

  getId(): string {
    return this.id
  }

  getFinancialRecordId(): string {
    return this.financialRecordId
  }

  getType(): ConceptType {
    return this.type
  }

  getChurchId(): string {
    return this.churchId
  }

  getAmount(): number {
    return this.amount
  }

  getAvailabilityAccountId(): string {
    return this.availabilityAccount.availabilityAccountId
  }

  getDate() {
    return this.date
  }

  toPrimitives() {
    return {
      financialConcept: this.financialConcept.toPrimitives(),
      financialRecordId: this.financialRecordId,
      churchId: this.churchId,
      amount: this.amount,
      date: this.date,
      type: this.type,
      availabilityAccount: this.availabilityAccount,
      voucher: this.voucher,
      description: this.description,
      costCenter: this.costCenter,
    }
  }
}
