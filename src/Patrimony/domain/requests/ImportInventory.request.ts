import type { AssetInventoryChecker } from "@/Patrimony"

export type ImportInventoryRequest = {
  fileContent: string
  performedByDetails: AssetInventoryChecker
}
