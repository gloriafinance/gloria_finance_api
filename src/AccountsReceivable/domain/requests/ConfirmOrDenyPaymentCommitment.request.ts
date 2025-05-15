import { Church } from "@/Church/domain"

export type ConfirmOrDenyPaymentCommitmentRequest = {
  token: string
  status: "ACCEPTED" | "DENIED"
  church?: Church
}
