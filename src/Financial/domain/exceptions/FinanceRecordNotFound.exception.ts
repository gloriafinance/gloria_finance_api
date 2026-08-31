import { DomainException } from "@/Shared/domain"

export class FinanceRecordNotFound extends DomainException {
  name = "FINANCIAL_RECORD_NOT_FOUND"
  message = "Financial movement not found"
}
