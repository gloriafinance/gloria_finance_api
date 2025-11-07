type AuthenticatedUser = {
  churchId: string
  isSuperuser?: boolean
}

export type RetryBankStatementHttpRequest = {
  params: { bankStatementId?: string }
  user: AuthenticatedUser
  body?: { churchId?: string }
}
