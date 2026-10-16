import { statementPeriodFilter } from "@/Financial/domain/statementPeriodFilter"

describe("statementPeriodFilter", () => {
  it("selects a recurring payment by the month its competence belongs to", () => {
    // Debited on October 30th, belonging to November: the November report has to
    // see it, and October's must not.
    const filter = statementPeriodFilter({ year: 2026, month: 11 })

    expect(filter).toEqual({
      $or: [
        { recurringCompetence: { $gte: "2026-11", $lt: "2026-12" } },
        {
          recurringCompetence: null,
          date: {
            $gte: new Date(Date.UTC(2026, 10, 1)),
            $lt: new Date(Date.UTC(2026, 11, 1)),
          },
        },
      ],
    })
  })

  it("keeps selecting everything else by its own date", () => {
    const filter = statementPeriodFilter({ year: 2026, month: 10 })
    const fallback = (filter.$or as Record<string, unknown>[])[1] as {
      date: { $gte: Date; $lt: Date }
    }

    expect(fallback.date.$gte).toEqual(new Date(Date.UTC(2026, 9, 1)))
    expect(fallback.date.$lt).toEqual(new Date(Date.UTC(2026, 10, 1)))
  })

  it("spans the whole year for an annual report", () => {
    const filter = statementPeriodFilter({ year: 2026 })
    const competences = (filter.$or as Record<string, unknown>[])[0] as {
      recurringCompetence: { $gte: string; $lt: string }
    }

    expect(competences.recurringCompetence).toEqual({
      $gte: "2026-01",
      $lt: "2027-01",
    })
  })

  it("closes December into the next year", () => {
    const filter = statementPeriodFilter({ year: 2026, month: 12 })
    const competences = (filter.$or as Record<string, unknown>[])[0] as {
      recurringCompetence: { $lt: string }
    }

    expect(competences.recurringCompetence.$lt).toBe("2027-01")
  })
})
