export enum AssetInventoryStatus {
  CONFIRMED = "CONFIRMED",
  NOT_FOUND = "NOT_FOUND",
}

export const AssetInventoryStatusLabels: Record<AssetInventoryStatus, string> = {
  [AssetInventoryStatus.CONFIRMED]: "Conferido",
  [AssetInventoryStatus.NOT_FOUND]: "Não encontrado",
}
