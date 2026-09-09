import {
  type ConnectExternalAccountRequest,
  type IBankRepository,
  type IChurchBankingClient,
  TypeBankAccount,
} from "@/Banking/domain"
import { CreateOrUpdateBank } from "@/Banking/applications/CreateOrUpdateBank.ts"
import type { IChurchRepository } from "@/Church/domain"

export class ConnectProviderBankAccount {
  constructor(
    private readonly bankRepository: IBankRepository,
    private readonly churchRepository: IChurchRepository,
    private readonly churchBankingClient: IChurchBankingClient
  ) {}

  async execute(request: ConnectExternalAccountRequest) {
    const account = await this.churchBankingClient.connectExternalAccount({
      externalAccountId: request.churchId,
      apiKey: request.apiKey,
    })

    const bank = await new CreateOrUpdateBank(
      this.bankRepository,
      this.churchRepository
    ).execute({
      bankId: account.accountId,
      accountType: TypeBankAccount.CURRENT_ACCOUNT,
      active: true,
      name: request.connectionName,
      tag: request.connectionName,
      addressInstancePayment: "",
      bankInstruction: {
        codeBank: account.accountNumber.codeBank,
        agency: account.accountNumber.agency,
        account: `${account.accountNumber.account}-${account.accountNumber.accountDigit}`,
      },
      churchId: request.churchId,
    })

    return { account, bank }
  }
}
