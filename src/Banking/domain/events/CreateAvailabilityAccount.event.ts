import type { DomainEvent } from "@/package/events"
import { AccountType } from "@/FinanceConfig/domain"

type request = {
  balance: number
  churchId: string
  accountName: string
  accountType: AccountType
  source: any
  symbol: string
}
export class CreateAvailabilityAccountDomainEvent implements DomainEvent {
  static readonly EVENT_NAME = "availability-account.event"
  readonly eventName: string = CreateAvailabilityAccountDomainEvent.EVENT_NAME
  readonly occurredOn: Date

  constructor(readonly payload: request) {
    this.occurredOn = new Date()
  }
}
