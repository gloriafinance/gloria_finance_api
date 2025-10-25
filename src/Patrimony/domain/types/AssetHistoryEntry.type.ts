export type AssetHistoryEntry = {
  entryId: string
  action: string
  performedBy: string
  performedAt: Date
  notes?: string
  changes?: Record<string, { previous?: any; current?: any }>
}
