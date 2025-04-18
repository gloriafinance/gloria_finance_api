export type AccountPayableRequest = {
  supplierId: string
  churchId: string
  description: string
  installments: {
    amount: number
    dueDate: Date
  }[]
}
