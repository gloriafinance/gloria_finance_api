export enum DevotionalStatus {
  PENDING = "pending",
  GENERATING = "generating",
  IN_REVIEW = "in_review",
  APPROVED = "approved",
  SENDING = "sending",
  SENT = "sent",
  FAILED = "failed",
}

export const DEVOTIONAL_STATUS_VALUES = Object.values(DevotionalStatus)
