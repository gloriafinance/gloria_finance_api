import { ActionsFinancialMonth, IFinancialYearRepository } from "../domain"
import type { UpdateFinancialMonthRequest } from "../domain"
import {
  FinancialMontNotFound,
  FinancialMonthIsClosed,
} from "../domain/exceptions"
import { Logger } from "@/Shared/adapter"

/**
 * Este caso de uso se encarga de cerrar o abrir un mes financiero.
 */
export class UpdateFinancialMonth {
  private logger = Logger(UpdateFinancialMonth.name)

  constructor(
    private readonly financialYearRepository: IFinancialYearRepository
  ) {}

  async execute(args: UpdateFinancialMonthRequest): Promise<void> {
    this.logger.info(`Closing financial month:`, args)

    const financialMonth = await this.financialYearRepository.one({
      month: args.month,
      year: args.year,
      churchId: args.churchId,
    })

    if (!financialMonth) {
      this.logger.info(`Financial month not found`)
      throw new FinancialMontNotFound()
    }

    if (args.action === ActionsFinancialMonth.CLOSE) {
      // The month is taken into CLOSING first, atomically. Only then is what is
      // in flight counted, and while it lasts no new execution can be validated
      // for that period, so the count and the final write cannot be separated by
      // a payment starting.
      const reservationSeq = await this.financialYearRepository.claimClosing({
        churchId: args.churchId,
        month: args.month,
        year: args.year,
      })
      if (reservationSeq === null) throw new FinancialMonthIsClosed()

      // The claim is released on every path that does not finish, including a
      // transient failure: leaving the month in CLOSING would block new
      // executions and prevent any further close until somebody edits Mongo.
      let finished = false
      try {
        // Nothing from other contexts is consulted: the sequence claimed above is
        // what proves no settlement was reserved for this month while it was being
        // closed, and a settlement that lands later is recorded by the booking
        // path, which invalidates this period's materialized report.
        finished = await this.financialYearRepository.finishClosing({
          churchId: args.churchId,
          month: args.month,
          year: args.year,
          closedBy: args.closedBy,
          expectedReservationSeq: reservationSeq,
        })
        // A reservation moved the sequence while this close was running, so the
        // finally releases the claim and the close is retried later.
        if (!finished)
          this.logger.error(`Financial month changed while closing`, {
            reservationSeq,
          })
      } finally {
        if (!finished) {
          await this.financialYearRepository.releaseClosing({
            churchId: args.churchId,
            month: args.month,
            year: args.year,
          })
        }
      }
      return
    }

    financialMonth.open()
    await this.financialYearRepository.upsert(financialMonth)
  }
}
