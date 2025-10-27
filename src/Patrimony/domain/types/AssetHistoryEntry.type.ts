import { AssetInventoryChecker } from "./AssetInventoryChecker.type"

export type AssetHistoryEntry = {
  entryId: string
  action: string
  performedByDetails: AssetInventoryChecker
  performedAt: Date
  notes?: string
  changes?: Record<string, { previous?: any; current?: any }>
}
