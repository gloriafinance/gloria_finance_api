import { AssetInventoryChecker } from "@/Patrimony"

export type ImportInventoryRequest = {
  filePath: string
  performedByDetails: AssetInventoryChecker
}
