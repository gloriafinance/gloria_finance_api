import { AssetStatus } from "../enums/AssetStatus.enum"

export type AssetDisposalRecord = {
  status: AssetStatus
  reason: string
  performedByDetails: {
    memberId: string
    name: string
    email: string
  }

  occurredAt: Date
  notes?: string
}
