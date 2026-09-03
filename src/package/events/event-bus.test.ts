import { describe, expect, it } from "bun:test"
import { EventBus } from "./event-bus.ts"

describe("EventBus.hasSubscriber", () => {
  it("returns false when no subscriptions exist for the event", () => {
    const bus = new (EventBus as any)() as EventBus
    expect(bus.hasSubscriber("some.event", "SomeSubscriber")).toBe(false)
  })

  it("returns false when the event has subscribers but not the requested one", () => {
    const bus = new (EventBus as any)() as EventBus
    bus.subscribe("some.event", "OtherSubscriber", async () => {})

    expect(bus.hasSubscriber("some.event", "SomeSubscriber")).toBe(false)
    expect(bus.hasSubscriber("some.event", "OtherSubscriber")).toBe(true)
  })

  it("returns true when the specific subscriber is registered", () => {
    const bus = new (EventBus as any)() as EventBus
    bus.subscribe("some.event", "SomeSubscriber", async () => {})

    expect(bus.hasSubscriber("some.event", "SomeSubscriber")).toBe(true)
  })

  it("distinguishes between different events", () => {
    const bus = new (EventBus as any)() as EventBus
    bus.subscribe("event.a", "SubA", async () => {})
    bus.subscribe("event.b", "SubB", async () => {})

    expect(bus.hasSubscriber("event.a", "SubA")).toBe(true)
    expect(bus.hasSubscriber("event.a", "SubB")).toBe(false)
    expect(bus.hasSubscriber("event.b", "SubB")).toBe(true)
    expect(bus.hasSubscriber("event.b", "SubA")).toBe(false)
  })
})

describe("EventBus.hasSubscribers", () => {
  it("returns false when no subscriptions exist", () => {
    const bus = new (EventBus as any)() as EventBus
    expect(bus.hasSubscribers("some.event")).toBe(false)
  })

  it("returns true when at least one subscriber exists", () => {
    const bus = new (EventBus as any)() as EventBus
    bus.subscribe("some.event", "Sub1", async () => {})
    expect(bus.hasSubscribers("some.event")).toBe(true)
  })
})
