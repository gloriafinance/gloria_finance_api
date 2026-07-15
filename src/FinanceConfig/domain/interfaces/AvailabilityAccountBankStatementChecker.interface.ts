export interface IAvailabilityAccountBankStatementChecker {
  exists(availabilityAccountId: string, churchId: string): Promise<boolean>
}
