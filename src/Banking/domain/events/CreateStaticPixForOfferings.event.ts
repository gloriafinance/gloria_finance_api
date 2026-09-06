import type { DomainEvent } from "@/package/events"

export class CreateStaticPixForOfferingsDomainEvent implements DomainEvent {
  static readonly EVENT_NAME = "static-pix-for-offerings.event"
  readonly eventName: string = CreateStaticPixForOfferingsDomainEvent.EVENT_NAME
  readonly occurredOn: Date

  constructor(readonly payload: { churchId: string }) {
    this.occurredOn = new Date()
  }
}
