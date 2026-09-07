import type { IChurchBankingClient } from "@/Banking/domain"
import { FinancialConceptNotFound } from "@/FinanceConfig/domain/exceptions/FinancialConceptNotFound.exception"
import type { IFinancialConceptRepository } from "@/FinanceConfig/domain/interfaces/FinancialConceptRepository.interface"
import { Logger } from "@/Shared/adapter"

export class CreateStaticPixForConcept {
  private logger = Logger(CreateStaticPixForConcept.name)

  constructor(
    private readonly churchBankingClient: IChurchBankingClient,
    private readonly financialConceptRepository: IFinancialConceptRepository
  ) {}

  async execute(params: {
    churchId: string
    financialConceptId: string
  }): Promise<{ copyPaste: string; encodedImage: string }> {
    this.logger.info(
      `Handle static pix for concept connected to start onboarding. ${params.churchId} - ${params.financialConceptId}`
    )

    const { churchId, financialConceptId } = params

    const concept = await this.financialConceptRepository.one({
      churchId: churchId,
      financialConceptId: financialConceptId,
    })

    if (!concept) {
      throw new FinancialConceptNotFound()
    }

    if (concept.hasStaticPix()) {
      this.logger.info(
        `Static pix already created for concept. ${churchId} - ${concept.getFinancialConceptId()}`
      )
      return concept.getStaticPix()!
    }

    const response = await this.churchBankingClient.createStaticPix({
      churchId,
      referenceId: concept.getFinancialConceptId(),
      description: concept.getName(),
    })

    this.logger.info(
      `Static pix created for concept. ${churchId} - ${concept.getFinancialConceptId()}`
    )

    concept.setStaticPix(response)

    await this.financialConceptRepository.upsert(concept)

    return response
  }
}
