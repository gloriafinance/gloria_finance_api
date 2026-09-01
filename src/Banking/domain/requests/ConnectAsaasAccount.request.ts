export type ConnectAsaasAccountRequest = {
  churchId: string
  apiKey: string
}

export type ConnectAsaasAccountResponse = {
  accountId: string
  externalAccountId: string
  status: "ACTIVE"
  connectionMode: "EXTERNAL_API_KEY"
}
