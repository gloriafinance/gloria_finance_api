import { EventBus } from "@/package/events"
import { CreateAvailabilityAccountSubscriber } from "@/FinanceConfig/infrastructure/subscribers/CreateAvailabilityAccount.subscriber.ts"

export const RunSubscribeEvent = () => {
  const eventBus = EventBus.instance()

  eventBus.subscribeSubscriber(new CreateAvailabilityAccountSubscriber())
}
