export type TransactionAI = {
  originalDate: string
  originalDescription: string
  amount: number
  categoryId: string
  categoryName: string
  type: "income" | "expense" | "transfer"
  reasoning: string
  toAccount: string | null
}
export type TransactionGroupRequest = {
  userId: string
  accountId: string
  year: number
  month: number
  currency: string
  expense: TransactionAI[] | null
  income: TransactionAI[] | null
  transfer: TransactionAI[] | null
}
