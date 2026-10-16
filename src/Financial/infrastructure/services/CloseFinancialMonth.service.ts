import dayjs from "dayjs"
import timezone from "dayjs/plugin/timezone"
import utc from "dayjs/plugin/utc"
import { ChurchMongoRepository } from "@/Church/infrastructure"
import { FinancialYearMongoRepository } from "@/ConsolidatedFinancial/infrastructure"
import { ActionsFinancialMonth } from "@/ConsolidatedFinancial/domain"
import { UpdateFinancialMonth } from "@/ConsolidatedFinancial/applications/FinancialMonth"
import { DRE } from "@/Reports/applications"
import { FinanceRecordMongoRepository } from "@/Financial/infrastructure"
import { DREMongoRepository } from "@/Reports/infrastructure/persistence/DREMongoRepository"
import { Logger } from "@/Shared/adapter"

dayjs.extend(utc)
dayjs.extend(timezone)

/**
 * The close runs on a schedule in São Paulo time, but `new Date()` answers in the
 * runtime's timezone: at 23:30 on October 31st in São Paulo it is already
 * November 1st in UTC, so deriving the period from the process clock closed the
 * wrong month (and, on December 31st, the wrong year).
 */
const CLOSE_TIMEZONE = "America/Sao_Paulo"
const logger = Logger("CloseFinancialMonthService")

export const CloseFinancialMonthService = async (): Promise<void> => {
  const churches = await ChurchMongoRepository.getInstance().all()
  const period = dayjs().tz(CLOSE_TIMEZONE)
  const year = period.year()
  const month = period.month() + 1

  for (const church of churches) {
    // The two steps are separate on purpose: materializing the DRE is retryable
    // on its own. A month that is already closed must not stop the snapshot from
    // being written, otherwise a failure during the first run would never be
    // repaired by a later one.
    await ensureClosed(church.getChurchId(), month, year)
    await ensureDreMaterialized(church.getChurchId(), month, year)
  }
}

async function ensureClosed(
  churchId: string,
  month: number,
  year: number
): Promise<void> {
  // A church with recurring operations in flight legitimately refuses to close.
  // That decision belongs to that church only: the failure is caught here so the
  // run still tries the DRE and the rest of the tenants.
  try {
    await new UpdateFinancialMonth(
      FinancialYearMongoRepository.getInstance()
    ).execute({
      action: ActionsFinancialMonth.CLOSE,
      churchId,
      month,
      year,
      closedBy: "system",
    })
  } catch (error: unknown) {
    // Skipping this church only: a legitimately refused close cannot stop the
    // rest of the tenants from closing their own month.
    logger.warn(`Financial month not closed for church`, {
      churchId,
      month,
      year,
      error: error instanceof Error ? error.message : "UNKNOWN",
    })
  }
}

/**
 * The closed month is a snapshot of its result. It is written every run, so a
 * failure while writing it is repaired by the next one even though the month is
 * already closed and there is nothing left to close.
 */
async function ensureDreMaterialized(
  churchId: string,
  month: number,
  year: number
): Promise<void> {
  try {
    await new DRE(
      FinanceRecordMongoRepository.getInstance(),
      DREMongoRepository.getInstance(),
      ChurchMongoRepository.getInstance()
    ).generateAndSaveDRE({ churchId, month, year })
  } catch (error: unknown) {
    logger.error(`DRE not materialized for closed month`, {
      churchId,
      month,
      year,
      error: error instanceof Error ? error.message : "UNKNOWN",
    })
  }
}
