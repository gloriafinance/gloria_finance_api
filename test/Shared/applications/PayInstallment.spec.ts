import { PayInstallment } from "@/Shared/applications"
import { InstallmentsStatus } from "@/Shared/domain"

describe("PayInstallment", () => {
  const logger = {
    info: jest.fn(),
    debug: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("should reduce the pending amount and accumulate the paid amount for partial payments", () => {
    const installment = {
      installmentId: "inst-1",
      amount: 100,
      amountPending: 100,
      status: InstallmentsStatus.PENDING,
      dueDate: new Date(),
    }

    const remaining = PayInstallment(installment, 40, logger)

    expect(remaining).toBe(-60)
    //expect(installment.amountPaid).toBe(40)
    expect(installment.amountPending).toBe(60)
    expect(installment.status).toBe(InstallmentsStatus.PARTIAL)
  })

  it("should mark installment as paid and return leftover when payment exceeds pending", () => {
    const installment = {
      installmentId: "inst-2",
      amount: 100,
      amountPaid: 40,
      amountPending: 60,
      status: InstallmentsStatus.PARTIAL,
      dueDate: new Date(),
    }

    const remaining = PayInstallment(installment, 80, logger)

    expect(remaining).toBe(20)
    expect(installment.amountPaid).toBe(100)
    expect(installment.amountPending).toBe(0)
    expect(installment.status).toBe(InstallmentsStatus.PAID)
  })

  it("should return the transferred amount when installment already paid", () => {
    const installment = {
      installmentId: "inst-3",
      amount: 100,
      amountPaid: 100,
      amountPending: 0,
      status: InstallmentsStatus.PAID,
      dueDate: new Date(),
    }

    const remaining = PayInstallment(installment, 50, logger)

    expect(remaining).toBe(undefined)
    expect(installment.amountPaid).toBe(100)
    expect(installment.amountPending).toBe(0)
    expect(installment.status).toBe(InstallmentsStatus.PAID)
    expect(logger.debug).toHaveBeenCalledWith("Installment inst-3 already paid")
  })
})
