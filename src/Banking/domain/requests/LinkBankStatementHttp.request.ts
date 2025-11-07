type AuthenticatedUser = {
  churchId: string
}

export type LinkBankStatementHttpRequest = {
  params: { bankStatementId?: string }
  body: { financialRecordId?: string }
  user: AuthenticatedUser
}
