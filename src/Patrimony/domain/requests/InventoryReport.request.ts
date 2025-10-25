import { AssetStatus } from "../enums/AssetStatus.enum"

export type InventoryReportFormat = "csv" | "pdf"

export type InventoryReportRequest = {
  churchId?: string
  category?: string
  status?: AssetStatus
  format: InventoryReportFormat
  performedBy: string
}
