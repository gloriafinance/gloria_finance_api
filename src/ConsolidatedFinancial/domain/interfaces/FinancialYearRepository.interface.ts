import {
  type IRepository,
  type MongoTransaction,
} from "@abejarano/ts-mongodb-criteria"
import { FinancialMonth } from "../FinancialMonth"

export interface IFinancialYearRepository extends IRepository<FinancialMonth> {
  /**
   * Takes the month into CLOSING atomically. It returns false when the month is
   * already closed or somebody else is closing it, so only one close proceeds.
   */
  claimClosing(input: {
    churchId: string
    month: number
    year: number
  }): Promise<number | null>

  /**
   * CLOSING → CLOSED, but only while the reservation sequence is still the one
   * the claim read. It returns false when a reservation moved it, which means the
   * close has to be retried instead of closing over a live payment.
   */
  finishClosing(input: {
    churchId: string
    month: number
    year: number
    closedBy: string
    expectedReservationSeq: number
  }): Promise<boolean>

  /**
   * Records that a payment is being reserved for this month. It is the write that
   * makes the reservation and the close conflict: it only succeeds while the month
   * is OPEN, and it moves the sequence the close checks before finishing. Optional
   * transaction so both writes belong to the same unit of work.
   */
  markReservation(
    input: { churchId: string; month: number; year: number },
    transaction?: MongoTransaction
  ): Promise<boolean>

  /** Gives the month back when the close is refused, so it stays usable. */
  releaseClosing(input: {
    churchId: string
    month: number
    year: number
  }): Promise<void>
}
