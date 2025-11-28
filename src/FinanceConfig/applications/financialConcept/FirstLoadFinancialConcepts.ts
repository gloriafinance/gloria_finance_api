import * as fs from "fs"
import * as path from "path"
import { IFinancialConceptRepository } from "../../../Financial/domain/interfaces"
import { ChurchNotFound, IChurchRepository } from "@/Church/domain"
import {
  ConceptType,
  FinancialConcept,
  StatementCategory,
} from "../../../Financial/domain"

type rawFinancialConcept = {
  name: string
  description: string
  type: ConceptType
  statementCategory: StatementCategory
  active: boolean
  affectsCashFlow: boolean
  affectsResult: boolean
  affectsBalance: boolean
  isOperational: boolean
}

export class FirstLoadFinancialConcepts {
  constructor(
    private readonly financialConceptRepository: IFinancialConceptRepository,
    private readonly churchRepository: IChurchRepository
  ) {}

  async execute(churchId: string) {
    const church = await this.churchRepository.one(churchId)
    if (!church) {
      throw new ChurchNotFound()
    }

    const financialConcepts = this.readFinancialConcepts()

    for (const concept of financialConcepts) {
      await this.financialConceptRepository.upsert(
        FinancialConcept.create(
          concept.name,
          concept.description,
          concept.active,
          concept.type,
          concept.statementCategory,
          church,
          {
            affectsCashFlow: concept.affectsCashFlow,
            affectsResult: concept.affectsResult,
            affectsBalance: concept.affectsBalance,
            isOperational: concept.isOperational,
          }
        )
      )
    }
  }

  private readFinancialConcepts(): rawFinancialConcept[] {
    const rawData = fs.readFileSync(
      path.resolve(__dirname, "@/fixtures/financialConcepts.json"),
      "utf-8"
    )
    return JSON.parse(rawData) as rawFinancialConcept[]
  }
}
