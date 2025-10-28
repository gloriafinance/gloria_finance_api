export enum ConceptType {
  INCOME = "INCOME",
  DISCHARGE = "OUTGO",
  PURCHASE = "PURCHASE",
  REVERSAL = "REVERSAL",
}
export const ConceptTypeLabels: Record<ConceptType, string> = {
  [ConceptType.INCOME]: "Receita",
  [ConceptType.DISCHARGE]: "Despesa",
  [ConceptType.PURCHASE]: "Compra",
  [ConceptType.REVERSAL]: "Estorno",
}
