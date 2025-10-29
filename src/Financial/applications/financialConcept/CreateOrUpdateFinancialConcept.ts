import { IFinancialConceptRepository } from "@/Financial/domain/interfaces"
import { ChurchNotFound, IChurchRepository } from "@/Church/domain"
import { FinancialConcept, FinancialConceptRequest } from "@/Financial/domain"
import { FindChurchById } from "@/Church/applications"
import { Logger } from "@/Shared/adapter"

export class CreateOrUpdateFinancialConcept {
  private logger = Logger(CreateOrUpdateFinancialConcept.name)
  private searchChurch: FindChurchById

  constructor(
    private readonly financialConceptRepository: IFinancialConceptRepository,
    private readonly churchRepository: IChurchRepository
  ) {
    this.searchChurch = new FindChurchById(this.churchRepository)
  }

  async execute(params: FinancialConceptRequest) {
    this.logger.info(`CreateOrUpdateFinancialConcept`, {
      params,
    })

    const church = await this.searchChurch.execute(params.churchId)
    if (!church) {
      this.logger.error(`Church not found`, { churchId: params.churchId })
      throw new ChurchNotFound()
    }

    const financialConcept = await this.financialConceptRepository.one({
      churchId: params.churchId,
      financialConceptId: params.financialConceptId,
    })

    if (financialConcept) {
      this.logger.info(`Updating financial concept`)

      params.active ? financialConcept.enable() : financialConcept.disable()

      financialConcept.setType(params.type)
      financialConcept.setName(params.name)
      financialConcept.setDescription(params.description)
      financialConcept.setStatementCategory(params.statementCategory)

      await this.financialConceptRepository.upsert(financialConcept)

      return
    }

    this.logger.info(`Creating new financial concept`)

    const newFinancialConcept = FinancialConcept.create(
      params.name,
      params.description,
      params.active,
      params.type,
      params.statementCategory,
      church
    )

    await this.financialConceptRepository.upsert(newFinancialConcept)
  }
}
