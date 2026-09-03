import type { DomainEventSubscriber } from "@/package/events"
import { CreateAvailabilityAccountDomainEvent } from "@/Banking/domain/events/CreateAvailabilityAccount.event.ts"
import { Logger } from "@/Shared/adapter"
import { CreateAvailabilityAccount } from "@/FinanceConfig/applications"
import { AvailabilityAccountMongoRepository } from "@/FinanceConfig/infrastructure/presistence"

export class CreateAvailabilityAccountSubscriber implements DomainEventSubscriber<CreateAvailabilityAccountDomainEvent> {
  readonly eventName: string = CreateAvailabilityAccountDomainEvent.EVENT_NAME
  readonly subscriptionName: string = CreateAvailabilityAccountSubscriber.name

  private logger = Logger(CreateAvailabilityAccountSubscriber.name)

  constructor() {
    this.logger.info("Initialize create availability account subscriber")
  }

  async handle(event: CreateAvailabilityAccountDomainEvent): Promise<void> {
    this.logger.info(
      "Handle account connected to start onboarding.",
      event.payload
    )

    const { payload } = event

    await new CreateAvailabilityAccount(
      AvailabilityAccountMongoRepository.getInstance()
    ).execute({
      churchId: payload.churchId,
      accountName: payload.accountName,
      active: true,
      accountType: payload.accountType,
      symbol: payload.symbol,
      source: payload.source,
      balance: payload.balance,
    })
  }
}
