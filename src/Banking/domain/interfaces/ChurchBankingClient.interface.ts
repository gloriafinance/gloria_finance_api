export type ChurchBankingScope =
  | "banking:accounts:create"
  | "banking:payments:create"
  | "banking:onboarding:documents:upload"

export type ChurchBankingCommand<TPayload> = {
  path: string
  scope: ChurchBankingScope
  payload: TPayload
}

export interface IChurchBankingClient {
  execute<TPayload, TResponse>(
    command: ChurchBankingCommand<TPayload>
  ): Promise<TResponse>
}
