import { AssetStatus } from "../enums/AssetStatus.enum"

export type AssetDisposalRecord = {
  status: AssetStatus
  reason: string
  performedBy: string
  occurredAt: Date
  notes?: string
}
