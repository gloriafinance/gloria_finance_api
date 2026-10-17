/**
 * Durable identity of one banking execution: the reference Glória sends to
 * church-banking, persists in `currentPayment` and receives back in the
 * confirmation webhook. A competence has exactly one of these.
 */
export function recurringPaymentExternalReference(
  recurringPaymentId: string,
  competence: string
): string {
  return `urn:recurringPayment:${recurringPaymentId}:${competence}`
}
