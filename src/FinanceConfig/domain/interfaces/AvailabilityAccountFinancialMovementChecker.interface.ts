export interface IAvailabilityAccountFinancialMovementChecker {
  exists(availabilityAccountId: string, churchId: string): Promise<boolean>
}
