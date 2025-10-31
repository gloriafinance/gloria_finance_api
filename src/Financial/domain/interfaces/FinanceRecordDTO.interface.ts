import { MoneyLocation } from "../enums/MoneyLocation.enum"

export interface IFinanceRecordDTO {
  amount: number
  date: string
  financialConcept: {
    financialConceptId: string
    name: string
    affectsCashFlow?: boolean
    affectsResult?: boolean
    affectsBalance?: boolean
    isOperational?: boolean
  }
  financialRecordId: string

  moneyLocation: MoneyLocation
}
