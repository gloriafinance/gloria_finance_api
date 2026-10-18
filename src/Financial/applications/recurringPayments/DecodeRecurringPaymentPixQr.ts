import type {
  DecodePixQrResponse,
  IChurchBankingClient,
} from "@/Banking/domain/interfaces/ChurchBankingClient.interface"
import type { IRecurringPaymentsRepository } from "@/Financial/domain/interfaces/RecurringPaymentsRepository.interface"
import type { IAvailabilityAccountRepository } from "@/FinanceConfig/domain/interfaces/AvailabilityAccountRepository.interface"
import type { IBankRepository } from "@/Banking/domain/interfaces/BankRepository.interface"
import { Provider } from "@/Banking/domain/enums/Provider.enum"
import { AccountType } from "@/FinanceConfig/domain/enums/AccountType.enum"
import { RecurringPaymentException } from "@/Financial/domain/exceptions/RecurringPayment.exception"

/** Reads a PIX QR payload through the banking service without moving money. */
export class DecodeRecurringPaymentPixQr {
  constructor(
    private readonly recurringPaymentsRepository: IRecurringPaymentsRepository,
    private readonly availabilityAccountRepository: IAvailabilityAccountRepository,
    private readonly bankRepository: IBankRepository,
    private readonly churchBankingClient: IChurchBankingClient
  ) {}

  async execute(
    churchId: string,
    recurringPaymentId: string,
    availabilityAccountId: string,
    payload: string
  ): Promise<DecodePixQrResponse> {
    const recurring = await this.recurringPaymentsRepository.one({
      recurringPaymentId,
      churchId,
      status: "ACTIVE",
    })
    if (!recurring) {
      throw new RecurringPaymentException("RECURRING_PAYMENT_NOT_FOUND")
    }

    const account = await this.availabilityAccountRepository.one({
      availabilityAccountId,
      churchId,
      active: true,
    })
    const bankId = account?.getSource()?.bankId
    if (!account || account.getType() !== AccountType.BANK || !bankId) {
      throw new RecurringPaymentException(
        "RECURRING_PAYMENT_AVAILABILITY_ACCOUNT_UNAVAILABLE"
      )
    }
    const bank = await this.bankRepository.findById(bankId)
    if (!bank?.isActive() || !bank.isConnectedTo(Provider.ASAAS)) {
      throw new RecurringPaymentException(
        "RECURRING_PAYMENT_BANK_ACCOUNT_UNAVAILABLE"
      )
    }

    return await this.churchBankingClient.decodePixQr({
      externalAccountId: recurring.getChurchId(),
      payload,
    })
  }
}
