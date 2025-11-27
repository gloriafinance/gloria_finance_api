export type PolicyStatus = {
  accepted: boolean
  version: string
  acceptedAt: Date | null
}

export type UserPolicies = {
  privacyPolicy?: PolicyStatus
  sensitiveDataPolicy?: PolicyStatus
}
