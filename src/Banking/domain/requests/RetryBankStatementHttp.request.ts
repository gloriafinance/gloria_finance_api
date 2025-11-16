type AuthenticatedUser = {
  churchId: string
  isSuperuser?: boolean
}

export type RetryBankStatementHttpRequest = {
  params: { bankStatementId?: string }
  auth: AuthenticatedUser
  body?: { churchId?: string }
}
