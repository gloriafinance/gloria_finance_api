import { FinancialConcept } from "@/Financial/domain"

export interface IFinancialConceptRepository {
  one(filter: object): Promise<FinancialConcept | undefined>

  listByCriteria(filter: object): Promise<FinancialConcept[]>

  upsert(financialConcept: FinancialConcept): Promise<void>
}
