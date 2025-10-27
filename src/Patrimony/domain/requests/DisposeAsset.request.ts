import { AssetStatus } from "../enums/AssetStatus.enum"

export type AssetDisposalStatus =
  | AssetStatus.DONATED
  | AssetStatus.SOLD
  | AssetStatus.LOST

export type DisposeAssetRequest = {
  assetId: string
  status: AssetDisposalStatus
  reason: string
  disposedAt?: string
  observations?: string
  performedByDetails: {
    memberId: string
    name: string
    email: string
  }
}
