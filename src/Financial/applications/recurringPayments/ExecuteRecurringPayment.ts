import { ChurchBankingClientError } from "@/Banking/domain/exceptions/ChurchBankingClient.exception"
import type {
  ChurchBankingBillPaymentResponse,
  ChurchBankingPixTransferResponse,
  IChurchBankingClient,
  PayPixQrResponse,
} from "@/Banking/domain/interfaces/ChurchBankingClient.interface"
import type { IBankRepository } from "@/Banking/domain/interfaces/BankRepository.interface"
import type { IAvailabilityAccountRepository } from "@/FinanceConfig/domain/interfaces/AvailabilityAccountRepository.interface"
import type {
  CurrentRecurringPayment,
  RecurringPaymentExecutionStatus,
  RecurringPayments,
} from "@/Financial/domain/RecurringPayments"
import { recurringPaymentExternalReference } from "@/Financial/domain/RecurringPaymentReference"
import type {
  PayRecurringPaymentMethod,
  PayRecurringPaymentRequest,
} from "@/Financial/domain/requests/RecurringPayment.request"
import type { IRecurringPaymentsRepository } from "@/Financial/domain/interfaces/RecurringPaymentsRepository.interface"
import { RecurringPaymentException as PaymentError } from "@/Financial/domain/exceptions/RecurringPayment.exception"
import { assertCompetence } from "./RecurringPaymentCompetence"
import { Provider } from "@/Banking/domain/enums/Provider.enum"
import { FinancialMonthValidator } from "@/ConsolidatedFinancial/applications"
import type { IFinancialYearRepository } from "@/ConsolidatedFinancial/domain/interfaces/FinancialYearRepository.interface"
import type { IFinancialRecordRepository } from "@/Financial/domain/interfaces"
import { createHash } from "node:crypto"
import type { RegisterRecurringPaymentFinancialRecord } from "./RegisterRecurringPaymentFinancialRecord"

export type ExecuteRecurringPaymentResult = {
  /**
   * `PAID` is a confirmation that just arrived; `ALREADY_PAID` is a competence
   * that already had its record before this command ran. Both are successes and
   * the caller must not treat them the same way only if it cares about the origin.
   */
  status: "PROCESSING" | "BLOCKED" | "FAILED" | "PAID" | "ALREADY_PAID"
  competence: string
  /**
   * Provider code for the refusal, answered to the caller and never stored: the
   * domain keeps its own states, the operator keeps the provider's reason.
   */
  failureCode?: string
  /** Amount the boleto charges, read from the line by church-banking. */
  providerValueInCents?: number
}

export class ExecuteRecurringPayment {
  constructor(
    private readonly recurringPaymentsRepository: IRecurringPaymentsRepository,
    private readonly financialRecordRepository: IFinancialRecordRepository,
    private readonly bankRepository: IBankRepository,
    private readonly availabilityAccountRepository: IAvailabilityAccountRepository,
    private readonly financialYearRepository: IFinancialYearRepository,
    private readonly churchBankingClient: IChurchBankingClient,
    private readonly recordRegistrar: RegisterRecurringPaymentFinancialRecord,
    private readonly now: () => Date = () => new Date()
  ) {}

  async execute(
    churchId: string,
    recurringPaymentId: string,
    request: PayRecurringPaymentRequest,
    createdBy: string
  ): Promise<ExecuteRecurringPaymentResult> {
    assertCompetence(request.competence)
    const recurring = await this.recurringPaymentsRepository.one({
      recurringPaymentId,
      churchId,
      status: "ACTIVE",
    })

    if (!recurring) {
      throw new PaymentError("RECURRING_PAYMENT_NOT_FOUND")
    }

    const existing = recurring.getCurrentPayment()
    const inFlight =
      existing && existing.status !== "FAILED" ? existing : undefined

    if (inFlight) {
      if (inFlight.competence !== request.competence) {
        throw new PaymentError("RECURRING_PAYMENT_IN_PROGRESS")
      }
      return await this.continueInFlight(
        recurring,
        inFlight,
        request,
        createdBy
      )
    }

    // Reuses the repository lookup so a voided record does not count as paid;
    // otherwise a cancelled competence could be registered manually but never
    // paid again through the bank.
    const alreadyPaid =
      await this.financialRecordRepository.findRecurringPayment(
        recurringPaymentId,
        request.competence
      )
    if (alreadyPaid)
      return { status: "ALREADY_PAID", competence: request.competence }

    const amount = this.resolveAmount(recurring, request)
    const method = this.resolveMethod(recurring, request)
    // Everything that could make the payment unbookable is checked before the
    // provider is called: after the debit there is no way back, and a rejected
    // accounting entry would leave real money moved with no record of it.
    await this.assertExecutionPreconditions(recurring, request.competence)
    const account = await this.resolveAccount(churchId, request)

    const externalReference = recurringPaymentExternalReference(
      recurringPaymentId,
      request.competence
    )
    const currentPayment: CurrentRecurringPayment = {
      competence: request.competence,
      externalReference,
      amount,
      paymentMethod: method.type,
      executionDestination: this.destinationOf(method),
      bankId: account.bankId,
      availabilityAccountId: account.availabilityAccountId,
      status: "PROCESSING",
      ...(method.type === "BILL"
        ? { identificationField: method.identificationField }
        : {}),
      updatedAt: this.now(),
    }

    recurring.reserveCurrentPayment(currentPayment)
    const reserved =
      await this.recurringPaymentsRepository.saveIfCurrentPaymentMatches(
        recurring,
        existing
      )
    if (!reserved) {
      const winner = await this.recurringPaymentsRepository.one({
        recurringPaymentId,
      })
      const winningPayment = winner?.getCurrentPayment()
      if (winningPayment?.competence === request.competence)
        return this.result(winningPayment)

      throw new PaymentError("RECURRING_PAYMENT_IN_PROGRESS")
    }

    return await this.submit(recurring, currentPayment, method, createdBy)
  }

  async reconcilePixQr(
    churchId: string,
    recurringPaymentId: string,
    competence: string,
    createdBy: string
  ): Promise<ExecuteRecurringPaymentResult> {
    assertCompetence(competence)
    const recurring = await this.recurringPaymentsRepository.one({
      recurringPaymentId,
      churchId,
      status: "ACTIVE",
    })
    if (!recurring) {
      throw new PaymentError("RECURRING_PAYMENT_NOT_FOUND")
    }

    const payment = recurring.getCurrentPayment()
    if (
      !payment ||
      payment.competence !== competence ||
      payment.paymentMethod !== "PIX_QR"
    ) {
      throw new PaymentError("RECURRING_PAYMENT_IN_PROGRESS")
    }
    if (payment.status === "FAILED" || payment.status === "PAID") {
      return this.result(payment)
    }
    // A network failure before Church Banking returned leaves no evidence that
    // it reserved this reference. Keep the outcome uncertain; a status request
    // must never become a new payment command in that case.
    if (payment.status !== "PROCESSING" || !payment.providerPaymentReserved) {
      return this.result(payment)
    }

    const response = await this.churchBankingClient.getPixQrStatus({
      externalAccountId: recurring.getChurchId(),
      externalReference: payment.externalReference,
    })
    return await this.applyPixQrResult(recurring, payment, response, createdBy)
  }

  /**
   * An operation already exists for this competence. Nothing may start a second
   * one: a confirmed failure is the only state that resumes the workflow, and
   * even then the reference identifies the competence.
   */
  private async continueInFlight(
    recurring: RecurringPayments,
    payment: CurrentRecurringPayment,
    request: PayRecurringPaymentRequest,
    createdBy: string
  ): Promise<ExecuteRecurringPaymentResult> {
    // Anything that is not a failure is left alone: an operation in flight is
    // resolved by the confirmation webhook, which is the only writer of the
    // financial record, and a paid one already has its record.
    if (payment.status !== "FAILED") {
      if (payment.paymentMethod === "PIX_QR") {
        const method = this.resolveMethod(recurring, request)
        if (
          method.type !== "PIX_QR" ||
          payment.executionDestination !== this.qrFingerprint(method.payload)
        ) {
          throw new PaymentError("RECURRING_PAYMENT_IN_PROGRESS")
        }
        if (
          payment.status === "PROCESSING" &&
          payment.providerPaymentReserved
        ) {
          return await this.submit(recurring, payment, method, createdBy)
        }
      }
      return this.result(payment)
    }

    // A confirmed failure is retriable and the retry is free to change the method
    // or the amount: nothing was debited, so the correction is the point of
    // retrying. An unknown outcome is not a failure (it stays PROCESSING) and is
    // resolved by the confirmation webhook, never by paying again.
    return await this.submit(
      recurring,
      payment,
      this.resolveMethod(recurring, request),
      createdBy
    )
  }

  /**
   * The only precondition that cannot be checked when the recurrence is configured:
   * the financial month of the competence has to be open, and that changes with
   * time. The concept and the cost center are validated where the recurrence is
   * configured and again where the record is written, so neither is repeated here.
   */
  private async assertExecutionPreconditions(
    recurring: RecurringPayments,
    competence: string
  ): Promise<void> {
    const churchId = recurring.getChurchId()

    const [year, month] = competence.split("-").map(Number)
    await new FinancialMonthValidator(this.financialYearRepository).validate({
      churchId,
      year,
      month,
    })
  }

  /**
   * FIXED amount comes from the configuration and must not be supplied again;
   * VARIABLE requires the amount for this competence. One owner for the rule.
   */
  private resolveAmount(
    recurring: RecurringPayments,
    request: PayRecurringPaymentRequest
  ): number {
    const configuredAmount = recurring.getAmount()
    if (configuredAmount !== undefined) {
      if (request.amount !== undefined)
        throw new PaymentError("RECURRING_PAYMENT_AMOUNT_FORBIDDEN")
      return configuredAmount
    }
    if (
      request.amount === undefined ||
      !Number.isFinite(request.amount) ||
      request.amount <= 0 ||
      Math.abs(request.amount * 100 - Math.round(request.amount * 100)) > 1e-7
    ) {
      throw new PaymentError("RECURRING_PAYMENT_AMOUNT_REQUIRED")
    }
    return request.amount
  }

  /**
   * The method belongs to this execution. An explicit command method wins;
   * otherwise a stored PIX destination makes PIX the direct path. There is no
   * persisted method fallback — see ADR-001.
   */
  private resolveMethod(
    recurring: RecurringPayments,
    request: PayRecurringPaymentRequest
  ): PayRecurringPaymentMethod {
    if (request.payment) return request.payment

    const destination = recurring.getPixDestination()
    if (destination) {
      return {
        type: "PIX",
        pixKey: destination.pixKey,
        pixKeyType: destination.pixKeyType,
      }
    }

    throw new PaymentError("RECURRING_PAYMENT_INVALID")
  }

  /**
   * A church may hold several accounts, so the account is chosen per execution.
   * An explicit choice wins; otherwise a single usable account is implied.
   */
  private async resolveAccount(
    churchId: string,
    request: PayRecurringPaymentRequest
  ): Promise<{ bankId: string; availabilityAccountId: string }> {
    // church-banking debits the account bound to the church, so only the bank
    // connected to the provider is a valid source of funds here. Any other bank
    // of the church would be recorded as the origin of a debit it never made.
    const activeBanks = (await this.bankRepository.all(churchId)).filter(
      (bank) => bank.isActive() && bank.isConnectedTo(Provider.ASAAS)
    )
    if (activeBanks.length === 0) {
      throw new PaymentError("RECURRING_PAYMENT_BANK_ACCOUNT_UNAVAILABLE")
    }

    const banksById = new Map(
      activeBanks.map((bank) => [bank.getBankId(), bank] as const)
    )
    const accounts = await this.availabilityAccountRepository.list({
      churchId,
      active: true,
      "source.bankId": { $in: [...banksById.keys()] },
    })
    if (accounts.length === 0) {
      throw new PaymentError("RECURRING_PAYMENT_BANK_ACCOUNT_UNAVAILABLE")
    }

    const requested = request.availabilityAccountId
      ? accounts.find(
          (account) =>
            account.getAvailabilityAccountId() === request.availabilityAccountId
        )
      : undefined
    if (!requested && request.availabilityAccountId) {
      throw new PaymentError(
        "RECURRING_PAYMENT_AVAILABILITY_ACCOUNT_UNAVAILABLE"
      )
    }
    // Several accounts and no explicit choice would silently pick the wrong
    // source of funds, so the caller must decide.
    if (!requested && accounts.length > 1) {
      throw new PaymentError(
        "RECURRING_PAYMENT_AVAILABILITY_ACCOUNT_UNAVAILABLE"
      )
    }

    const selected = requested ?? accounts[0]!
    const bankId = selected.getSource()?.bankId
    if (!bankId || !banksById.has(bankId)) {
      throw new PaymentError("RECURRING_PAYMENT_BANK_ACCOUNT_UNAVAILABLE")
    }
    return {
      bankId,
      availabilityAccountId: selected.getAvailabilityAccountId(),
    }
  }

  private async submit(
    recurring: RecurringPayments,
    payment: CurrentRecurringPayment,
    method: PayRecurringPaymentMethod,
    createdBy: string
  ): Promise<ExecuteRecurringPaymentResult> {
    if (method.type === "PIX_QR") {
      return await this.submitPixQr(recurring, payment, method, createdBy)
    }
    let response:
      ChurchBankingPixTransferResponse | ChurchBankingBillPaymentResponse
    try {
      if (method.type === "PIX") {
        response = await this.churchBankingClient.createPixTransfer({
          externalAccountId: recurring.getChurchId(),
          amountInCents: this.toCents(payment.amount),
          pixKey: method.pixKey,
          pixKeyType: method.pixKeyType,
          description: recurring.getName(),
          externalReference: payment.externalReference,
        })
      } else {
        response = await this.churchBankingClient.createBillPayment({
          externalAccountId: recurring.getChurchId(),
          identificationField: method.identificationField,
          description: recurring.getName(),
          externalReference: payment.externalReference,
        })
      }
    } catch (error) {
      if (!(error instanceof ChurchBankingClientError)) throw error
      // Only a confirmed rejection proves no debit happened, so it is the only
      // status that releases the reservation as FAILED. Anything else is
      // ambiguous and stays PROCESSING: a retry could double the debit.
      if (!isConfirmedBankingRejection(error)) {
        return this.result(payment, undefined, error.code)
      }

      const next: CurrentRecurringPayment = {
        ...payment,
        status: "FAILED",
        updatedAt: this.now(),
      }
      recurring.updateCurrentPayment(next)
      await this.recurringPaymentsRepository.saveIfCurrentPaymentMatches(
        recurring,
        payment
      )
      return this.result(next, undefined, error.code)
    }

    return this.applyBankingResult(recurring, payment, response)
  }

  private async submitPixQr(
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
      if (!isConfirmedBankingRejection(error)) {
        return this.result(payment, undefined, error.code)
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
      return this.result(failed, undefined, error.code)
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
    return this.result(next, response.amountInCents, pixQrErrorCode(response))
  }

  private async applyBankingResult(
    recurring: RecurringPayments,
    payment: CurrentRecurringPayment,
    response:
      ChurchBankingPixTransferResponse | ChurchBankingBillPaymentResponse
  ): Promise<ExecuteRecurringPaymentResult> {
    const executionStatus = executionStatusOf(response.status)
    const confirmed = executionStatus === "PAID"
    const providerValueInCents =
      "valueInCents" in response ? response.valueInCents : undefined
    const paymentDate = "paymentDate" in response ? response.paymentDate : null
    const transactionReceiptUrl =
      "transactionReceiptUrl" in response
        ? response.transactionReceiptUrl
        : null

    const next: CurrentRecurringPayment = {
      ...payment,
      // A boleto is charged for whatever its line says, so the amount the bank
      // reports is the authoritative amount of a confirmed execution, not the one
      // declared locally. A PIX transfer carries its own amount, which the
      // response does not redefine.
      ...(confirmed && providerValueInCents !== undefined
        ? { amount: providerValueInCents / 100 }
        : {}),
      status: executionStatus,
      ...(paymentDate ? { paymentDate } : {}),
      ...(transactionReceiptUrl ? { transactionReceiptUrl } : {}),
      updatedAt: this.now(),
    }
    recurring.updateCurrentPayment(next)
    await this.recurringPaymentsRepository.saveIfCurrentPaymentMatches(
      recurring,
      payment
    )
    // The financial record is not created here: the confirmation webhook is its
    // only writer, so an immediate PAID and a late confirmation take the same
    // path.
    return this.result(next, providerValueInCents)
  }

  private result(
    payment: CurrentRecurringPayment,
    providerValueInCents?: number,
    failureCode?: string
  ): ExecuteRecurringPaymentResult {
    return {
      status: payment.status,
      competence: payment.competence,
      ...(failureCode ? { failureCode } : {}),
      ...(providerValueInCents !== undefined ? { providerValueInCents } : {}),
    }
  }

  /** The payee data that identifies this execution's target. */
  private destinationOf(method: PayRecurringPaymentMethod): string {
    if (method.type === "PIX_QR") return this.qrFingerprint(method.payload)
    return method.type === "PIX"
      ? `${method.pixKeyType}:${method.pixKey}`
      : method.identificationField
  }

  private qrFingerprint(payload: string): string {
    return `PIX_QR:${createHash("sha256").update(payload).digest("hex")}`
  }

  private toCents(amount: number): number {
    return Math.round(amount * 100)
  }
}

type ChurchBankingOutgoingState =
  | ChurchBankingPixTransferResponse["status"]
  | ChurchBankingBillPaymentResponse["status"]

/**
 * church-banking's answer translated into this service's own states. `PAID` is
 * a domain statement, not provider vocabulary; `PROCESSING` is the service's
 * "alive but not conclusive".
 */
function executionStatusOf(
  status: ChurchBankingOutgoingState
): RecurringPaymentExecutionStatus {
  if (status === "DONE" || status === "PAID") return "PAID"
  if (
    status === "FAILED" ||
    status === "CANCELLED" ||
    status === "CREATION_FAILED"
  ) {
    return "FAILED"
  }
  if (status === "BLOCKED") return "BLOCKED"
  return "PROCESSING"
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

/**
 * church-banking answers 422 for an outgoing payment its provider definitively
 * refused, which proves no money moved. Every other status is ambiguous and must
 * never be treated as a confirmed failure, or a retry could double the debit.
 */
function isConfirmedBankingRejection(error: ChurchBankingClientError): boolean {
  return error.status === 422
}

function pixQrErrorCode(response: PayPixQrResponse): string | undefined {
  return "errorCode" in response ? response.errorCode : undefined
}
