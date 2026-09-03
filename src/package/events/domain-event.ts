export interface DomainEvent {
  readonly eventName: string
  readonly occurredOn: Date
}

export interface DomainEventSubscriber<
  TEvent extends DomainEvent = DomainEvent,
> {
  readonly eventName: string
  readonly subscriptionName: string
  handle(event: TEvent): Promise<void> | void
}
