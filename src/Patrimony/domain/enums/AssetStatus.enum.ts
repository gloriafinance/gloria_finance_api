export enum AssetStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  DONATED = "DONATED",
  SOLD = "SOLD",
  LOST = "LOST",
}

export const AssetStatusLabels: Record<AssetStatus, string> = {
  [AssetStatus.ACTIVE]: "Ativo",
  [AssetStatus.INACTIVE]: "Inativo",
  [AssetStatus.DONATED]: "Doado",
  [AssetStatus.SOLD]: "Vendido",
  [AssetStatus.LOST]: "Extraviado",
}
