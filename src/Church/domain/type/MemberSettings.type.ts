export type MemberSettings = {
  notifyPaymentCommitments: boolean
  notifyChurchEvents: boolean
  notifyStatusContributions: boolean
  platform?: "android" | "ios" | "web"
  deviceId?: string
  token?: string
  lang: string
}
