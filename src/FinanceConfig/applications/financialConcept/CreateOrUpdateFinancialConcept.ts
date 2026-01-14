import { IFinancialConceptRepository } from "@/Financial/domain/interfaces"
import { Church, ChurchNotFound, IChurchRepository } from "@/Church/domain"
import {
  FinancialConcept,
  type FinancialConceptRequest,
} from "@/Financial/domain"
import { FindChurchById } from "@/Church/applications"
import { Logger } from "@/Shared/adapter"
import {
  FinancialConceptNotFound,
  NotPossibleUpdateConcept,
} from "@/FinanceConfig/domain"

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

    if (!params?.financialConceptId) {
      await this.createFinancialConcept(params, church)
      return
    }

    const financialConcept = await this.financialConceptRepository.one({
      churchId: church.getChurchId(),
      financialConceptId: params?.financialConceptId,
    })

    if (!financialConcept) {
      this.logger.error(`Financial concept not found`, {
        churchId: church.getChurchId(),
        financialConceptId: params.financialConceptId,
      })

      throw new FinancialConceptNotFound()
    }

    if (financialConcept.isSystem) {
      this.logger.error(`Not possible to update system financial concept`, {
        churchId: church.getChurchId(),
        financialConceptId: params.financialConceptId,
      })

      throw new NotPossibleUpdateConcept()
    }
    this.logger.info(`Updating financial concept`)

    params.active ? financialConcept.enable() : financialConcept.disable()

    financialConcept.setType(params.type)
    financialConcept.setName(params.name)
    financialConcept.setDescription(params.description)
    financialConcept.setStatementCategory(params.statementCategory)

    financialConcept.updateImpactFlags({
      affectsCashFlow: params.affectsCashFlow,
      affectsResult: params.affectsResult,
      affectsBalance: params.affectsBalance,
      isOperational: params.isOperational,
    })

    await this.financialConceptRepository.upsert(financialConcept)

    return
  }

  private async createFinancialConcept(
    params: FinancialConceptRequest,
    church: Church
  ) {
    this.logger.info(`Creating new financial concept`)

    const newFinancialConcept = FinancialConcept.create(
      params.name,
      params.description,
      params.active,
      params.type,
      params.statementCategory,
      church,
      {
        affectsCashFlow: params.affectsCashFlow,
        affectsResult: params.affectsResult,
        affectsBalance: params.affectsBalance,
        isOperational: params.isOperational,
      }
    )

    await this.financialConceptRepository.upsert(newFinancialConcept)
  }
}
