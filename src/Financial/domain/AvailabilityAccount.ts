import { AccountType } from "./enums/AccountType.enum"
import { IdentifyEntity } from "../../Shared/adapter"
import { DateBR } from "../../Shared/helpers"
import { AggregateRoot } from "../../Shared/domain"

export class AvailabilityAccount extends AggregateRoot {
  private id?: string
  private churchId: string
  private availabilityAccountId: string
  private accountName: string
  private balance: number
  private active: boolean
  private accountType: AccountType
  private lastMove: Date
  private createdAt: Date
  private source?: any

  static create(
    churchId: string,
    accountName: string,
    active: boolean,
    accountType: AccountType,
    source?: any
  ): AvailabilityAccount {
    const account: AvailabilityAccount = new AvailabilityAccount()
    account.churchId = churchId
    account.availabilityAccountId = IdentifyEntity.get()
    account.accountName = accountName
    account.balance = 0
    account.active = active
    account.accountType = accountType
    account.createdAt = DateBR()
    account.source = source

    return account
  }

  static fromPrimitives(plainData: any): AvailabilityAccount {
    const account: AvailabilityAccount = new AvailabilityAccount()
    account.churchId = plainData.churchId
    account.availabilityAccountId = plainData.availabilityAccountId
    account.accountName = plainData.accountName
    account.balance = plainData.balance
    account.active = plainData.active
    account.accountType = plainData.accountType
    account.lastMove = plainData.lastMove
    account.createdAt = plainData.createdAt
    account.id = plainData._id
    account.source = plainData.source

    return account
  }

  getId(): string {
    return this.id
  }

  getSource() {
    return this.source
  }

  getChurchId() {
    return this.churchId
  }

  getAccountName() {
    return this.accountName
  }

  getAvailabilityAccountId() {
    return this.availabilityAccountId
  }

  getType(): AccountType {
    return this.accountType
  }

  setAccountName(accountName: string) {
    this.accountName = accountName
  }

  enable() {
    this.active = true
  }

  disable() {
    this.active = false
  }

  decreaseBalance(amount: number) {
    this.balance -= amount
    this.lastMove = DateBR()
  }

  increaseBalance(amount: number) {
    this.balance += amount
    this.lastMove = DateBR()
  }

  toPrimitives() {
    return {
      churchId: this.churchId,
      availabilityAccountId: this.availabilityAccountId,
      accountName: this.accountName,
      balance: this.balance,
      active: this.active,
      accountType: this.accountType,
      lastUpdate: this.lastMove,
      createdAt: this.createdAt,
      source: this.source,
    }
  }
}
