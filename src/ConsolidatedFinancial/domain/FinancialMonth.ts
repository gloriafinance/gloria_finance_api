import {
  AggregateRoot,
  type AggregateRelations,
} from "@abejarano/ts-mongodb-criteria"
import { DateBR } from "@/Shared/helpers"

export class FinancialMonth extends AggregateRoot {
  static collectionName(): string {
    return "financial_months"
  }

  static relations(): AggregateRelations {
    return {}
  }

  private financialMonthId: string
  private month: number
  private year: number
  private churchId: string
  private closed: boolean
  /**
   * The month is being closed. While it lasts, no new execution may be reserved
   * for it: the close only counts what is in flight once the door is shut, so a
   * payment cannot slip in between the count and the final write.
   */
  private closing: boolean
  /**
   * Monotonic sequence bumped by every execution reservation for this month.
   *
   * It is not a count: it is the token that makes the close atomic. The close
   * reads it when it claims the month and only finishes if it did not move, so a
   * reservation that commits between the in-flight count and the final write
   * makes the close retry instead of closing over a live payment.
   *
   * PENDING: the execution path does not bump it yet. Until it does, the sequence
   * never moves and the CAS always succeeds, so the close behaves as before. The
   * bump has to happen in the same transaction that reserves `currentPayment`,
   * with the filter that only lets it through while the month is OPEN.
   */
  private reservationSeq: number
  private closedAt?: Date
  private closedBy?: string

  static create(churchId: string, month: number, year: number): FinancialMonth {
    const financialMonths: FinancialMonth = new FinancialMonth()
    financialMonths.churchId = churchId
    financialMonths.month = month
    financialMonths.year = year
    financialMonths.closed = false
    financialMonths.closing = false
    financialMonths.reservationSeq = 0
    financialMonths.financialMonthId = `${year}-${month}:${churchId}`

    return financialMonths
  }

  static fromPrimitives(plainData: any): FinancialMonth {
    const financialMonths: FinancialMonth = new FinancialMonth()
    financialMonths.month = plainData.month
    financialMonths.year = plainData.year
    financialMonths.closed = plainData.closed
    financialMonths.closing = plainData.closing === true
    financialMonths.reservationSeq = Number(plainData.reservationSeq ?? 0)
    financialMonths.churchId = plainData.churchId
    financialMonths.financialMonthId = plainData.financialMonthId

    return financialMonths
  }

  close(closedBy: string): void {
    this.closed = true
    this.closing = false
    this.closedAt = DateBR()
    this.closedBy = closedBy
  }

  isClosed(): boolean {
    return this.closed
  }

  startClosing(): void {
    this.closing = true
  }

  isClosing(): boolean {
    return this.closing
  }

  open(): void {
    this.closed = false
    this.closing = false
  }

  toPrimitives() {
    return {
      financialMonthId: this.financialMonthId,
      churchId: this.churchId,
      month: this.month,
      year: this.year,
      closed: this.closed,
      closing: this.closing,
      reservationSeq: this.reservationSeq,
      closedAt: this.closedAt,
      closedBy: this.closedBy,
    }
  }
}
