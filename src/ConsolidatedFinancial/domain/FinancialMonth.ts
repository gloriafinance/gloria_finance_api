import { AggregateRoot } from "@abejarano/ts-mongodb-criteria"

export class FinancialMonth extends AggregateRoot {
  private id?: string
  private financialMonthId: string
  private month: number
  private year: number
  private churchId: string
  private closed: boolean

  static create(churchId: string, month: number, year: number): FinancialMonth {
    const financialMonths: FinancialMonth = new FinancialMonth()
    financialMonths.churchId = churchId
    financialMonths.month = month
    financialMonths.year = year
    financialMonths.closed = false
    financialMonths.financialMonthId = `${year}-${month}:${churchId}`

    return financialMonths
  }

  static fromPrimitives(plainData: any): FinancialMonth {
    const financialMonths: FinancialMonth = new FinancialMonth()
    financialMonths.id = plainData.id
    financialMonths.month = plainData.month
    financialMonths.year = plainData.year
    financialMonths.closed = plainData.closed
    financialMonths.churchId = plainData.churchId
    financialMonths.financialMonthId = plainData.financialMonthId

    return financialMonths
  }

  close(): void {
    this.closed = true
  }

  isClosed(): boolean {
    return this.closed
  }

  open(): void {
    this.closed = false
  }

  getId(): string {
    return this.id
  }

  toPrimitives() {
    return {
      financialMonthId: this.financialMonthId,
      churchId: this.churchId,
      month: this.month,
      year: this.year,
      closed: this.closed,
    }
  }
}
