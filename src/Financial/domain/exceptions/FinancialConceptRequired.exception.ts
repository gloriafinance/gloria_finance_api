import { DomainException } from "@/Shared/domain"

export class FinancialConceptRequired extends DomainException {
  name = "FINANCIAL_CONCEPT_REQUIRED"
  message = "Financial concept is required"
}
