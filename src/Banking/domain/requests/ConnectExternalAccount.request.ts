export type ConnectExternalAccountRequest = {
  churchId: string
  apiKey: string
  connectionName: string
}

export type ConnectExternalAccountResponse = {
  accountId: string
  externalAccountId: string
  status: "ACTIVE"
  connectionMode: "EXTERNAL_API_KEY"
}
