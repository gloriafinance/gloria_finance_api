import { ConceptType, FinancialRecordType } from "@/Financial/domain"

export const toFinancialRecordType = (
  type: ConceptType
): FinancialRecordType => {
  switch (type) {
    case ConceptType.INCOME:
      return FinancialRecordType.INCOME
    case ConceptType.OUTGO:
      return FinancialRecordType.OUTGO
    case ConceptType.PURCHASE:
      return FinancialRecordType.PURCHASE
    case ConceptType.REVERSAL:
      return FinancialRecordType.REVERSAL
    default:
      return FinancialRecordType.TRANSFER
  }
}
