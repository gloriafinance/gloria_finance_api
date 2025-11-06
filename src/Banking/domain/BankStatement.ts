import { AggregateRoot } from "@abejarano/ts-mongodb-criteria"
import { IdentifyEntity } from "@/Shared/adapter"
import { DateBR } from "@/Shared/helpers"
import { BankStatementDirection } from "./enums/BankStatementDirection.enum"
import { BankStatementStatus } from "./enums/BankStatementStatus.enum"
import { IntermediateBankStatement } from "./types/IntermediateBankStatement.type"

export class BankStatement extends AggregateRoot {
  private id?: string
  private bankStatementId: string
  private churchId: string
  private bank: {
    bankName: string
    bankId: string
    tag: string
  }
  private availabilityAccount: {
    accountName: string
    availabilityAccountId: string
  }
  private postedAt: Date
  private amount: number
  private description: string
  private direction: BankStatementDirection
  private fitId: string
  private hash: string
  private month: number
  private year: number
  private reconciliationStatus: BankStatementStatus
  private financialRecordId?: string
  private reconciledAt?: Date
  private createdAt: Date
  private updatedAt: Date
  private raw?: Record<string, unknown>

  static create(intermediate: IntermediateBankStatement): BankStatement {
    const statement = new BankStatement()
    statement.bankStatementId = IdentifyEntity.get("bankStatement")
    statement.churchId = intermediate.bank.getChurchId()
    statement.bank = {
      bankName: intermediate.bank.getBankName(),
      bankId: intermediate.bank.getBankId(),
      tag: intermediate.bank.getTag(),
    }
    statement.availabilityAccount = intermediate.availabilityAccount
    statement.postedAt = intermediate.postedAt
    statement.amount = intermediate.amount
    statement.description = intermediate.description
    statement.direction = intermediate.direction
    statement.fitId = intermediate.fitId
    statement.hash = intermediate.hash
    statement.month = intermediate.month
    statement.year = intermediate.year
    statement.reconciliationStatus = BankStatementStatus.PENDING
    statement.createdAt = DateBR()
    statement.updatedAt = DateBR()
    statement.raw = intermediate.raw
    return statement
  }

  static fromPrimitives(primitives: any): BankStatement {
    const statement = new BankStatement()
    statement.id = primitives.id
    statement.bankStatementId = primitives.bankStatementId
    statement.churchId = primitives.churchId
    statement.bank = primitives.bank
    statement.availabilityAccount = primitives.availabilityAccount
    statement.postedAt = new Date(primitives.postedAt)
    statement.amount = primitives.amount
    statement.description = primitives.description
    statement.direction = primitives.direction
    statement.fitId = primitives.fitId
    statement.hash = primitives.hash
    statement.month = primitives.month
    statement.year = primitives.year
    statement.reconciliationStatus = primitives.reconciliationStatus
    statement.financialRecordId = primitives.financialRecordId
    statement.reconciledAt = primitives.reconciledAt
    statement.createdAt = primitives.createdAt
    statement.updatedAt = primitives.updatedAt
    statement.raw = primitives.raw
    return statement
  }

  getId(): string {
    return this.id
  }

  getAvailabilityAccount() {
    return this.availabilityAccount
  }

  reconcile(financialRecordId: string): void {
    this.financialRecordId = financialRecordId
    this.reconciliationStatus = BankStatementStatus.RECONCILED
    this.reconciledAt = DateBR()
    this.updatedAt = DateBR()
  }

  markUnmatched(): void {
    this.reconciliationStatus = BankStatementStatus.UNMATCHED
    this.financialRecordId = undefined
    this.reconciledAt = undefined
    this.updatedAt = DateBR()
  }

  getBankStatementId(): string {
    return this.bankStatementId
  }

  getChurchId(): string {
    return this.churchId
  }

  getFitId(): string {
    return this.fitId
  }

  getHash(): string {
    return this.hash
  }

  getReconciliationStatus(): BankStatementStatus {
    return this.reconciliationStatus
  }

  getPostedAt(): Date {
    return this.postedAt
  }

  getAmount(): number {
    return this.amount
  }

  getDirection(): BankStatementDirection {
    return this.direction
  }

  getFinancialRecordId(): string | undefined {
    return this.financialRecordId
  }

  getMonth(): number {
    return this.month
  }

  getYear(): number {
    return this.year
  }

  toPrimitives(): any {
    return {
      bankStatementId: this.bankStatementId,
      churchId: this.churchId,
      bank: this.bank,
      availabilityAccount: this.availabilityAccount,
      postedAt: this.postedAt,
      amount: this.amount,
      description: this.description,
      direction: this.direction,
      fitId: this.fitId,
      hash: this.hash,
      month: this.month,
      year: this.year,
      reconciliationStatus: this.reconciliationStatus,
      financialRecordId: this.financialRecordId,
      reconciledAt: this.reconciledAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      raw: this.raw,
    }
  }
}
