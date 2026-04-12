export type PurchaseEvent = {
  event: "update" | "delete"
  source: "accountPayablePaid" | "financialRegistrationCancelled"
  data: any
}
