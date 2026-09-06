import type { IChurchBankingClient } from "@/Banking/domain"
import type { IFinancialConceptRepository } from "@/FinanceConfig/domain/interfaces/FinancialConceptRepository.interface"
import { CreateAvailabilityAccountSubscriber } from "@/FinanceConfig/infrastructure/subscribers/CreateAvailabilityAccount.subscriber"
import { Logger } from "@/Shared/adapter"

export class CreateStaticPixForConcepts {
  private logger = Logger(CreateStaticPixForConcepts.name)

  constructor(
    private readonly churchBankingClient: IChurchBankingClient,
    private readonly financialConceptRepository: IFinancialConceptRepository
  ) {}

  async execute(churchId: string): Promise<void> {
    this.logger.info(
      `Handle static pix for offerings connected to start onboarding. ${churchId}`
    )

    const concepts = await this.financialConceptRepository.many({
      churchId,
      tag: { $in: ["Offering", "Tithes"] },
    })

    await Promise.all(
      concepts.map(async (concept) => {
        const response = await this.churchBankingClient.createStaticPix({
          churchId,
          referenceId: concept.getFinancialConceptId(),
          description: concept.getName(),
        })

        this.logger.info(
          `Static pix created for offering. ${churchId} - ${concept.getFinancialConceptId()}`
        )

        concept.setStaticPix(response)

        await this.financialConceptRepository.upsert(concept)
      })
    )
  }
}
