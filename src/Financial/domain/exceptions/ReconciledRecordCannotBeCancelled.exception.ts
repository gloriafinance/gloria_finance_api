import { DomainException } from "@/Shared/domain"

/**
 * A reconciled record cannot be undone.
 *
 * `RECONCILED` means the movement was matched against the bank and is backed by a
 * real debit. Reversing it locally would leave the ledger disagreeing with the
 * money that actually left the account, and the bank movement has no counterpart
 * to reverse.
 */
export class ReconciledRecordCannotBeCancelled extends DomainException {
  name = "RECONCILED_RECORD_CANNOT_BE_CANCELLED"
  message = "A reconciled financial record cannot be cancelled or reverted"
}
