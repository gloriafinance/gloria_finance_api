import { ConceptType } from "../../../Financial/domain"
import { ChurchNotFound, IChurchRepository } from "@/Church/domain"
import { IFinancialConceptRepository } from "../../../Financial/domain/interfaces"

export class FindFinancialConceptsByChurchIdAndTypeConcept {
  constructor(
    private readonly financialConceptRepository: IFinancialConceptRepository,
    private readonly churchRepository: IChurchRepository
  ) {}

  async execute(churchId: string, typeConcept?: ConceptType) {
    const church = await this.churchRepository.one(churchId)
    if (!church) {
      throw new ChurchNotFound()
    }

    let filter = { churchId }
    if (typeConcept) {
      filter["type"] = typeConcept
    }

    return await this.financialConceptRepository.listByCriteria(filter)
  }
}
