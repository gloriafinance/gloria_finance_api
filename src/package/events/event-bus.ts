import type { DomainEvent, DomainEventSubscriber } from "./domain-event.ts"

export class EventBus {
  private static _instance: EventBus
  private readonly subscriptions = new Map<
    string,
    Map<string, (event: DomainEvent) => Promise<void> | void>
  >()

  private constructor() {}

  static instance(): EventBus {
    if (!EventBus._instance) {
      EventBus._instance = new EventBus()
    }
    return EventBus._instance
  }

  subscribe<TEvent extends DomainEvent>(
    eventName: string,
    subscriptionName: string,
    callback: (event: TEvent) => Promise<void> | void
  ): void {
    const subscribers = this.subscriptions.get(eventName) ?? new Map()

    if (subscribers.has(subscriptionName)) {
      return
    }

    subscribers.set(
      subscriptionName,
      callback as (event: DomainEvent) => Promise<void> | void
    )
    this.subscriptions.set(eventName, subscribers)
  }

  subscribeSubscriber<TEvent extends DomainEvent>(
    subscriber: DomainEventSubscriber<TEvent>
  ): void {
    this.subscribe<TEvent>(
      subscriber.eventName,
      subscriber.subscriptionName,
      (event) => subscriber.handle(event)
    )
  }

  async publish<TEvent extends DomainEvent>(event: TEvent): Promise<void> {
    const subscribers = this.subscriptions.get(event.eventName)

    if (!subscribers || subscribers.size === 0) {
      return
    }

    for (const subscriber of subscribers.values()) {
      await subscriber(event)
    }
  }

  /**
   * Non-destructive check: does an event have any subscribers registered?
   * Used by bootstrap defenses (e.g. worker startup) to avoid treating
   * a publication with no subscribers as successful delivery.
   */
  hasSubscribers(eventName: string): boolean {
    const subscribers = this.subscriptions.get(eventName)
    return !!subscribers && subscribers.size > 0
  }

  /**
   * Non-destructive check: is a specific subscriber registered for an event?
   * Used by bootstrap defenses to require concrete subscribers (not just any).
   */
  hasSubscriber(eventName: string, subscriptionName: string): boolean {
    return this.subscriptions.get(eventName)?.has(subscriptionName) ?? false
  }
}
