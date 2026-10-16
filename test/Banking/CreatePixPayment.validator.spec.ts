import CreatePixPaymentValidator from "@/Banking/infrastructure/http/validators/CreatePixPayment.validator"
import { HttpStatus } from "@/Shared/domain"

const buildRequest = (amount: unknown) =>
  ({
    body: {
      externalReference: "urn:accountReceivable:receivable-1",
      amount,
    },
  }) as any

const buildResponse = () =>
  ({
    status: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  }) as any

describe("CreatePixPaymentValidator", () => {
  it("accepts a numeric amount", async () => {
    const res = buildResponse()
    const next = jest.fn()

    await CreatePixPaymentValidator(buildRequest("10"), res, next)

    expect(res.status).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalled()
  })

  it("rejects a non-numeric amount", async () => {
    const res = buildResponse()
    const next = jest.fn()

    await CreatePixPaymentValidator(buildRequest("ten"), res, next)

    expect(res.status).toHaveBeenCalledWith(HttpStatus.UNPROCESSABLE_ENTITY)
    expect(next).not.toHaveBeenCalled()
  })
})
