import CreatePixPaymentValidator from "@/Banking/infrastructure/http/validators/CreatePixPayment.validator"
import { HttpStatus } from "@/Shared/domain"

describe("CreatePixPaymentValidator", () => {
  it("rejects numeric strings", async () => {
    const req = {
      body: {
        externalReference: "urn:accountReceivable:receivable-1",
        amount: "10",
      },
    } as any
    const res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    } as any
    const next = jest.fn()

    await CreatePixPaymentValidator(req, res, next)

    expect(res.status).toHaveBeenCalledWith(HttpStatus.UNPROCESSABLE_ENTITY)
    expect(next).not.toHaveBeenCalled()
  })
})
