import type { ChurchBankingOutgoingPaymentResponse } from "./interfaces/ChurchBankingClient.interface"
import { ChurchBankingClientError } from "./exceptions/ChurchBankingClient.exception"

/**
 * A bill is charged for whatever its line says, and that amount is the only
 * source the integrator has to book the expense. An accepted bill response
 * without a positive integer value would leave a real debit that can never be
 * recorded, so it is refused instead of accepted. A provider-confirmed failure
 * carries no charge and therefore needs no value.
 */
export function assertBilledValue(
  response: ChurchBankingOutgoingPaymentResponse
): ChurchBankingOutgoingPaymentResponse {
  if (
    response.status === "FAILED" ||
    response.status === "CANCELLED" ||
    response.status === "CREATION_FAILED"
  ) {
    return response
  }

  const value = response.valueInCents
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new ChurchBankingClientError(502, "CHURCH_BANKING_INVALID_RESPONSE")
  }
  return response
}
