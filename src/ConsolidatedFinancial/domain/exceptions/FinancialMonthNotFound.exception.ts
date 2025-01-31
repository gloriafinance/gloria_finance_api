import { DomainException } from "../../../Shared/domain"

export class FinancialMontNotFound extends DomainException {
  name = "FINANCIAL_MONTH_NOT_FOUND"
  message = "The financial month is not found"
}
