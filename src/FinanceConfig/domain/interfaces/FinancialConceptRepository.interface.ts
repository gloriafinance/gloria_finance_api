import { FinancialConcept } from "@/Financial/domain"
import type { IRepository } from "@abejarano/ts-mongodb-criteria"

export interface IFinancialConceptRepository extends IRepository<FinancialConcept> {
  search(filter: object): Promise<FinancialConcept[]>
}
