import { ConceptType, StatementCategory } from "../../../Financial/domain"
import { ChurchNotFound, type IChurchRepository } from "@/Church/domain"
import { type IFinancialConceptRepository } from "@/FinanceConfig/domain"

export class FindFinancialConceptsByChurchIdAndTypeConcept {
  constructor(
    private readonly financialConceptRepository: IFinancialConceptRepository,
    private readonly churchRepository: IChurchRepository
  ) {}

  async execute(
    churchId: string,
    typeConcept?: ConceptType,
    statementCategory?: StatementCategory
  ) {
    const church = await this.churchRepository.one({ churchId })
    if (!church) {
      throw new ChurchNotFound()
    }

    return await this.financialConceptRepository.search({
      churchId,
      type: typeConcept,
      statementCategory,
    })
  }
}
