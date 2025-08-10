import { DomainException } from "@/Shared/domain"

export class FinancialMovementNotFound extends DomainException {
  name = "FINANCIAL_MOVEMENT_NOT_FOUND"
  message = "Financial movement not found"
}
