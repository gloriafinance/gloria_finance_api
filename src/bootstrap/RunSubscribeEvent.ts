import { ChurchBankingClient } from "@/Banking/infrastructure/church-banking/ChurchBankingClient"
import { FinancialConceptMongoRepository } from "@/FinanceConfig/infrastructure/presistence/FinancialConceptMongoRepository"
import {
  CreateAvailabilityAccountSubscriber,
  CreateStaticPixForOfferingsSubscriber,
} from "@/FinanceConfig/infrastructure/subscribers"
import { EventBus } from "@/package/events"

export const RunSubscribeEvent = () => {
  const eventBus = EventBus.instance()

  eventBus.subscribeSubscriber(new CreateAvailabilityAccountSubscriber())

  eventBus.subscribeSubscriber(
    new CreateStaticPixForOfferingsSubscriber(
      new ChurchBankingClient(),
      FinancialConceptMongoRepository.getInstance()
    )
  )
}
