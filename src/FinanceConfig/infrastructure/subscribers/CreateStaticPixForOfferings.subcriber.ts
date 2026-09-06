import type {
  CreateStaticPixForOfferingsDomainEvent,
  IChurchBankingClient,
} from "@/Banking/domain"
import { CreateStaticPixForConcepts } from "@/FinanceConfig/applications"
import type { IFinancialConceptRepository } from "@/FinanceConfig/domain/interfaces/FinancialConceptRepository.interface"
import type { DomainEventSubscriber } from "@/package/events"
import { Logger } from "@/Shared/adapter"
import { FinancialConceptMongoRepository } from "../presistence"

export class CreateStaticPixForOfferingsSubscriber implements DomainEventSubscriber<CreateStaticPixForOfferingsDomainEvent> {
  eventName: string
  subscriptionName: string

  private logger = Logger(CreateStaticPixForOfferingsSubscriber.name)

  constructor(
    private readonly churchBankingClient: IChurchBankingClient,
    private readonly financialConceptRepository: IFinancialConceptRepository
  ) {
    this.logger.info("Initialize create static pix for offerings subscriber")
  }

  async handle(event: CreateStaticPixForOfferingsDomainEvent): Promise<void> {
    this.logger.info(
      `Handle static pix for offerings connected to start onboarding. ${event.payload.churchId}`
    )

    const { payload } = event

    await new CreateStaticPixForConcepts(
      this.churchBankingClient,
      this.financialConceptRepository
    ).execute(payload.churchId)
  }
}
