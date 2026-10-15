/**
 * External payment provider an account can be connected to.
 *
 * Stored on `Bank.provider`. A bank without a provider was registered manually
 * and is never the account a provider debits.
 */
export enum Provider {
  ASAAS = "ASAAS",
}
