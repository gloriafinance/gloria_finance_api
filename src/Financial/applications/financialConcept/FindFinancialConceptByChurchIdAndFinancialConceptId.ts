import { IFinancialConceptRepository } from "../../domain/interfaces"
import { GenericException } from "../../../Shared/domain"
import { Logger } from "../../../Shared/adapter"

export class FindFinancialConceptByChurchIdAndFinancialConceptId {
  private logger = Logger("FindFinancialConceptByChurchIdAndFinancialConceptId")

  constructor(
    private readonly financialConceptRepository: IFinancialConceptRepository
  ) {}

  async execute(churchId: string, financialConceptId: string) {
    this.logger.info(`FindFinancialConceptByChurchIdAndFinancialConceptId`, {
      churchId,
      financialConceptId,
    })

    const financialConcept =
      await this.financialConceptRepository.findFinancialConceptByChurchIdAndFinancialConceptId(
        churchId,
        financialConceptId
      )

    if (!financialConcept) {
      this.logger.error(`Financial concept not found`)
      throw new GenericException("Financial concept not found")
    }

    return financialConcept
  }
}
