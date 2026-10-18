export class ChurchBankingClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: string
  ) {
    super(`church-banking request failed with ${status} (${code})`)
    this.name = "ChurchBankingClientError"
  }
}
