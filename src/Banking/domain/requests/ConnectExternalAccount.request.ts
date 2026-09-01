export type ConnectExternalAccountRequest = {
  churchId: string
  apiKey: string
}

export type ConnectExternalAccountResponse = {
  accountId: string
  externalAccountId: string
  status: "ACTIVE"
  connectionMode: "EXTERNAL_API_KEY"
}
