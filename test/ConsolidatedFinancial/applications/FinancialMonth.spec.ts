import { UpdateFinancialMonth } from "@/ConsolidatedFinancial/applications/FinancialMonth"
import { ActionsFinancialMonth } from "@/ConsolidatedFinancial/domain"

describe("UpdateFinancialMonth", () => {
  const financialYearRepository = {
    one: jest.fn(),
    upsert: jest.fn(),
    claimClosing: jest.fn(),
    finishClosing: jest.fn(),
    releaseClosing: jest.fn(),
  }
  const financialMonth = {
    close: jest.fn(),
    open: jest.fn(),
    isClosed: jest.fn().mockReturnValue(false),
  }
  const request = {
    churchId: "church-1",
    month: 11,
    year: 2026,
    closedBy: "user-1",
  }

  const useCase = () =>
    new UpdateFinancialMonth(financialYearRepository as never)

  beforeEach(() => {
    jest.clearAllMocks()
    financialYearRepository.one.mockResolvedValue(financialMonth)
    financialYearRepository.claimClosing.mockResolvedValue(7)
    financialYearRepository.finishClosing.mockResolvedValue(true)
  })

  it("closes the month and finishes with the sequence it claimed", async () => {
    await useCase().execute({
      ...request,
      action: ActionsFinancialMonth.CLOSE,
    })

    expect(financialYearRepository.finishClosing).toHaveBeenCalledWith({
      churchId: "church-1",
      month: 11,
      year: 2026,
      closedBy: "user-1",
      expectedReservationSeq: 7,
    })
    expect(financialYearRepository.releaseClosing).not.toHaveBeenCalled()
  })

  it("releases the claim when a reservation moved the sequence", async () => {
    // Closing now would leave a live payment inside a reported period, so the
    // close gives the month back and is retried later.
    financialYearRepository.finishClosing.mockResolvedValue(false)

    await useCase().execute({ ...request, action: ActionsFinancialMonth.CLOSE })

    expect(financialYearRepository.releaseClosing).toHaveBeenCalledWith({
      churchId: "church-1",
      month: 11,
      year: 2026,
    })
  })

  it("lets only one close proceed when another one already claimed the month", async () => {
    // The claim is atomic, so a second close cannot count a different in-flight
    // set and write a conflicting result.
    financialYearRepository.claimClosing.mockResolvedValue(null)

    await expect(
      useCase().execute({ ...request, action: ActionsFinancialMonth.CLOSE })
    ).rejects.toMatchObject({ name: "FINANCIAL_MONTH_CLOSED" })
    expect(financialYearRepository.finishClosing).not.toHaveBeenCalled()
  })

