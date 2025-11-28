export enum ConceptType {
  INCOME = "INCOME",
  OUTGO = "OUTGO",
  PURCHASE = "PURCHASE",
  REVERSAL = "REVERSAL",
}
export const ConceptTypeLabels: Record<ConceptType, string> = {
  [ConceptType.INCOME]: "Receita",
  [ConceptType.OUTGO]: "Despesa",
  [ConceptType.PURCHASE]: "Compra",
  [ConceptType.REVERSAL]: "Estorno",
}
