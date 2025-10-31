import { ConceptType, FinancialConcept, StatementCategory } from "../../domain"
import { Church, ChurchNotFound, IChurchRepository } from "@/Church/domain"
import { IQueue } from "@/Shared/domain"
import { IFinancialConceptRepository } from "../../domain/interfaces"
import { Logger } from "@/Shared/adapter"

export class InitialLoadingFinancialConcepts implements IQueue {
  private logger = Logger("InitialLoadingFinancialConcepts")

  constructor(
    private readonly financialConceptRepository: IFinancialConceptRepository,
    private readonly churchRepository: IChurchRepository
  ) {}

  async handle(args: { churchId: string }): Promise<void> {
    this.logger.info(`Crear conceptos financieros para la iglesia`, args)

    const conceptBase = require("../../../fixtures/financialConcepts.json")

    const churchId = args.churchId

    const church: Church = await this.churchRepository.one(churchId)
    if (!church) {
      throw new ChurchNotFound()
    }

    for (const c of conceptBase) {
      await this.financialConceptRepository.upsert(
        FinancialConcept.create(
          c.name,
          c.description,
          c.active,
          c.type as ConceptType,
          c.statementCategory as StatementCategory,
          church,
          {
            affectsCashFlow: c.affectsCashFlow,
            affectsResult: c.affectsResult,
            affectsBalance: c.affectsBalance,
            isOperational: c.isOperational,
          }
        )
      )
    }

    this.logger.info(`Conceptos financieros creados con éxito para la iglesia`)
  }
}
