import { ChurchBankingClientError } from "@/Banking/domain/exceptions/ChurchBankingClient.exception"
import type {
  IChurchBankingClient,
  PayPixQrResponse,
} from "@/Banking/domain/interfaces/ChurchBankingClient.interface"
import type {
  CurrentRecurringPayment,
  RecurringPaymentExecutionStatus,
  RecurringPayments,
} from "@/Financial/domain/RecurringPayments"
import type { PayRecurringPaymentMethod } from "@/Financial/domain/requests/RecurringPayment.request"
import type { IRecurringPaymentsRepository } from "@/Financial/domain/interfaces/RecurringPaymentsRepository.interface"
import type { ExecuteRecurringPaymentResult } from "./ExecuteRecurringPayment"
import type { RegisterRecurringPaymentFinancialRecord } from "./RegisterRecurringPaymentFinancialRecord"

type PixQrBankingClient = Pick<
  IChurchBankingClient,
  "payPixQr" | "getPixQrStatus"
>

/** Owns PIX QR banking transitions; the caller owns validation and reservation. */
export class RecurringPixQrExecution {
  constructor(
    private readonly recurringPaymentsRepository: IRecurringPaymentsRepository,
    private readonly churchBankingClient: PixQrBankingClient,
    private readonly recordRegistrar: RegisterRecurringPaymentFinancialRecord,
    private readonly now: () => Date = () => new Date()
  ) {}

  /**
   * Only reads /qr/status. An unsuccessful read cannot prove a refusal, even
   * for a missing reference, so PROCESSING never triggers another /qr/pay.
   */
  async reconcile(
    recurring: RecurringPayments,
    payment: CurrentRecurringPayment,
    createdBy: string
  ): Promise<ExecuteRecurringPaymentResult> {
    if (payment.status !== "PROCESSING") {
      return { status: payment.status, competence: payment.competence }
    }

    let response: PayPixQrResponse
    try {
      response = await this.churchBankingClient.getPixQrStatus({
        externalAccountId: recurring.getChurchId(),
        externalReference: payment.externalReference,
      })
    } catch (error) {
      if (error instanceof ChurchBankingClientError) {
        return { status: payment.status, competence: payment.competence }
      }
      throw error
    }

    return await this.applyPixQrResult(recurring, payment, response, createdBy)
  }

  async submit(
    recurring: RecurringPayments,
    payment: CurrentRecurringPayment,
    method: Extract<PayRecurringPaymentMethod, { type: "PIX_QR" }>,
    createdBy: string
  ): Promise<ExecuteRecurringPaymentResult> {
    // QR execution has no webhook. If the transport fails, keep PROCESSING so a
    // repeat with the same payload/reference asks church-banking for its durable
    // result instead of creating a new payment.
    let response: PayPixQrResponse
    try {
      response = await this.churchBankingClient.payPixQr({
        externalAccountId: recurring.getChurchId(),
        externalReference: payment.externalReference,
        payload: method.payload,
        description: recurring.getName(),
      })
    } catch (error) {
      if (!(error instanceof ChurchBankingClientError)) throw error
      // church-banking answers 422 for a creation its provider confirmed was
      // refused, which proves no money moved: the reservation is released as
      // FAILED. Every other status (409, 5xx, transport) is ambiguous and stays
      // PROCESSING, because re-sending the payment could create a second debit.
      if (error.status !== 422) {
        return {
          status: payment.status,
          competence: payment.competence,
          failureCode: error.code,
        }
      }

      const failed: CurrentRecurringPayment = {
        ...payment,
        status: "FAILED",
        updatedAt: this.now(),
      }
      recurring.updateCurrentPayment(failed)
      await this.recurringPaymentsRepository.saveIfCurrentPaymentMatches(
        recurring,
        payment
      )
      return {
        status: failed.status,
        competence: failed.competence,
        failureCode: error.code,
      }
    }

    return await this.applyPixQrResult(recurring, payment, response, createdBy)
  }

  private async applyPixQrResult(
    recurring: RecurringPayments,
    payment: CurrentRecurringPayment,
    response: PayPixQrResponse,
    createdBy: string
  ): Promise<ExecuteRecurringPaymentResult> {
    const status = qrExecutionStatus(response.status)
    const next: CurrentRecurringPayment = {
      ...payment,
      amount: response.amountInCents / 100,
      status,
      providerPaymentReserved: true,
      updatedAt: this.now(),
    }

    if (status === "PAID") {
      await this.recordRegistrar.execute({
        recurring,
        competence: payment.competence,
        amount: response.amountInCents / 100,
        availabilityAccountId: payment.availabilityAccountId,
        paymentDate: this.now(),
        createdBy,
        bankingExternalReference: payment.externalReference,
      })
    }

    recurring.updateCurrentPayment(next)
    await this.recurringPaymentsRepository.saveIfCurrentPaymentMatches(
      recurring,
      payment
    )
    return {
      status,
      competence: payment.competence,
      providerValueInCents: response.amountInCents,
      ...("errorCode" in response ? { failureCode: response.errorCode } : {}),
    }
  }
}

function qrExecutionStatus(
  status: PayPixQrResponse["status"]
): RecurringPaymentExecutionStatus {
  if (status === "DONE") return "PAID"
  if (
    status === "REFUSED" ||
    status === "CANCELLED" ||
    status === "CREATION_FAILED"
  )
    return "FAILED"
  if (status === "CREATION_UNKNOWN") return "BLOCKED"
  return "PROCESSING"
}
