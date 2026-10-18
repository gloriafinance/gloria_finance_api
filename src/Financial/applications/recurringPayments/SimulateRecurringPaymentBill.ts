import type {
  BillIdentificationInput,
  BillSimulation,
  IChurchBankingClient,
} from "@/Banking/domain/interfaces/ChurchBankingClient.interface"
import type { IRecurringPaymentsRepository } from "@/Financial/domain/interfaces/RecurringPaymentsRepository.interface"
import { RecurringPaymentException } from "@/Financial/domain/exceptions/RecurringPayment.exception"

type BillSimulationClient = Pick<IChurchBankingClient, "simulateBill">

/**
 * Reads a boleto through church-banking so the payer can review it before
 * confirming. It moves no money and persists nothing: the only writes of this
 * flow belong to `/pay` and to the confirmation webhook.
 */
export class SimulateRecurringPaymentBill {
  constructor(
    private readonly recurringPaymentsRepository: IRecurringPaymentsRepository,
    private readonly churchBankingClient: BillSimulationClient
  ) {}

  async execute(
    churchId: string,
    recurringPaymentId: string,
    input: BillIdentificationInput
  ): Promise<BillSimulation> {
    // The ownership and the ACTIVE gate are the query itself, so a recurrence of
    // another church is indistinguishable from a missing one.
    const recurring = await this.recurringPaymentsRepository.one({
      recurringPaymentId,
      churchId,
      status: "ACTIVE",
    })
    if (!recurring) {
      throw new RecurringPaymentException("RECURRING_PAYMENT_NOT_FOUND")
    }

    return await this.churchBankingClient.simulateBill(
      "identificationField" in input
        ? {
            externalAccountId: recurring.getChurchId(),
            identificationField: input.identificationField,
          }
        : {
            externalAccountId: recurring.getChurchId(),
            barCode: input.barCode,
          }
    )
  }
}
