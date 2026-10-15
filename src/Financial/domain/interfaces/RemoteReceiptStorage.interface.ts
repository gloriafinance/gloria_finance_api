/**
 * Stores a receipt document issued by a remote banking provider in the church's
 * own file storage, returning the storage key to persist on the financial record.
 *
 * Application use cases depend on this capability only; the adapter owns every
 * provider-specific detail, including how the provider exposes its receipt.
 * This keeps provider knowledge out of the application layer.
 */
export interface IRemoteReceiptStorage {
  /**
   * @param id correlation id used for the stored file name (never sensitive)
   * @param receiptUrl provider receipt reference, interpreted by the adapter
   * @returns the stored voucher key, or undefined when no receipt could be stored
   */
  storeRemoteReceipt(
    id: string,
    receiptUrl: string
  ): Promise<string | undefined>
}
