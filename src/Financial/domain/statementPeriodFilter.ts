/**
 * Period selector of a result report (DRE, Income Statement).
 *
 * A recurring payment has two different dates and they must not be confused:
 *
 * - `date` is when the money actually moved (the cash fact);
 * - `recurringCompetence` (YYYY-MM) is the month the expense belongs to, which is
 *   what a result report has to show.
 *
 * A payment whose competence is November but was debited on October 30th belongs
 * to November's result. Rows without a competence — everything that is not a
 * recurring payment — keep selecting by `date`, so no behaviour changes for them.
 */
export function statementPeriodFilter(input: {
  readonly year: number
  readonly month?: number
}): Record<string, unknown> {
  const { year, month } = input
  const startDate = month
    ? new Date(Date.UTC(year, month - 1, 1))
    : new Date(Date.UTC(year, 0, 1))
  const endDate = month
    ? new Date(Date.UTC(year, month, 1))
    : new Date(Date.UTC(year + 1, 0, 1))

  const firstCompetence = `${year}-${String(month ?? 1).padStart(2, "0")}`
  const nextCompetence = month
    ? `${month === 12 ? year + 1 : year}-${String(month === 12 ? 1 : month + 1).padStart(2, "0")}`
    : `${year + 1}-01`

  return {
    $or: [
      {
        recurringCompetence: {
          $gte: firstCompetence,
          $lt: nextCompetence,
        },
      },
      {
        // `null` also matches a missing field, so rows that are not recurring
        // payments fall back to their own date.
        recurringCompetence: null,
        date: { $gte: startDate, $lt: endDate },
      },
    ],
  }
}
