import type {
  DecodePixQrResponse,
  IChurchBankingClient,
} from "@/Banking/domain/interfaces/ChurchBankingClient.interface"
import type { IRecurringPaymentsRepository } from "@/Financial/domain/interfaces/RecurringPaymentsRepository.interface"
import { RecurringPaymentException } from "@/Financial/domain/exceptions/RecurringPayment.exception"

/** Reads a PIX QR payload through the banking service without moving money. */
export class DecodeRecurringPaymentPixQr {
  constructor(
    private readonly recurringPaymentsRepository: IRecurringPaymentsRepository,
    private readonly churchBankingClient: IChurchBankingClient
  ) {}

  async execute(
    churchId: string,
    recurringPaymentId: string,
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

    return await this.churchBankingClient.decodePixQr({
      externalAccountId: recurring.getChurchId(),
      payload,
    })
  }
}
