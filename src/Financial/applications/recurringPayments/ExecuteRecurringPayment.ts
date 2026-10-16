import { ChurchBankingClientError } from "@/Banking/domain/exceptions/ChurchBankingClient.exception"
import type { ChurchBankingOutgoingPaymentResponse } from "@/Banking/domain/interfaces/ChurchBankingClient.interface"
import type { IChurchBankingClient } from "@/Banking/domain/interfaces/ChurchBankingClient.interface"
import type { IBankRepository } from "@/Banking/domain/interfaces/BankRepository.interface"
import type { IAvailabilityAccountRepository } from "@/FinanceConfig/domain/interfaces/AvailabilityAccountRepository.interface"
import type { IFinancialConceptRepository } from "@/FinanceConfig/domain/interfaces/FinancialConceptRepository.interface"
import type { IFinancialConfigurationRepository } from "@/FinanceConfig/domain/interfaces/FinancialConfigurationRepository.interface"
import type {
  CurrentRecurringPayment,
  RecurringPayments,
} from "@/Financial/domain/RecurringPayments"
import type {
  PayRecurringPaymentMethod,
  PayRecurringPaymentRequest,
} from "@/Financial/domain/requests/RecurringPayment.request"
import type { IRecurringPaymentsRepository } from "@/Financial/domain/interfaces/RecurringPaymentsRepository.interface"
import type { IQueueService } from "@/package/queue/domain"
import { QueueService } from "@/package/queue/infrastructure/QueueService"
import type { IRemoteReceiptStorage } from "@/Financial/domain/interfaces/RemoteReceiptStorage.interface"
import { RegisterRecurringPaymentFinancialRecord } from "./RegisterRecurringPaymentFinancialRecord"
import { RecurringPaymentException as PaymentError } from "@/Financial/domain/exceptions/RecurringPayment.exception"
import { assertCompetence } from "./RecurringPaymentCompetence"
import { Provider } from "@/Banking/domain/enums/Provider.enum"
import { ConceptType } from "@/FinanceConfig/domain/enums/ConcepType.enum"
import { FinancialMonthValidator } from "@/ConsolidatedFinancial/applications"
import type { IFinancialYearRepository } from "@/ConsolidatedFinancial/domain/interfaces/FinancialYearRepository.interface"
import type { IFinancialRecordRepository } from "@/Financial/domain/interfaces"

export type ExecuteRecurringPaymentResult = {
  status: "PROCESSING" | "BLOCKED" | "FAILED" | "ALREADY_PAID"
  competence: string
  /** Amount charged by this execution. Comes from the boleto for BILL. */
  amount?: number
  /** Amount the boleto charges, read from the line by church-banking. */
  providerValueInCents?: number
  failureCode?: string
}

export class ExecuteRecurringPayment {
  private readonly recordRegistrar: RegisterRecurringPaymentFinancialRecord

  constructor(
    private readonly recurringPaymentsRepository: IRecurringPaymentsRepository,
    private readonly financialRecordRepository: IFinancialRecordRepository,
    private readonly bankRepository: IBankRepository,
    private readonly availabilityAccountRepository: IAvailabilityAccountRepository,
    private readonly financialConceptRepository: IFinancialConceptRepository,
    private readonly financialConfigurationRepository: IFinancialConfigurationRepository,
    private readonly financialYearRepository: IFinancialYearRepository,
    private readonly churchBankingClient: IChurchBankingClient,
    private readonly receiptStorage: IRemoteReceiptStorage,
    private readonly queueService: IQueueService = QueueService.getInstance(),
    private readonly now: () => Date = () => new Date()
  ) {
    this.recordRegistrar = new RegisterRecurringPaymentFinancialRecord(
      financialRecordRepository,
      availabilityAccountRepository,
      financialConceptRepository,
      financialConfigurationRepository,
      queueService
    )
  }

  async execute(
    churchId: string,
    recurringPaymentId: string,
    request: PayRecurringPaymentRequest
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
    if (recurring.requiresCostCenterAssignment()) {
      throw new PaymentError("RECURRING_PAYMENT_COST_CENTER_INVALID")
    }

    const existing = recurring.getCurrentPayment()
    const inFlight =
      existing && existing.status !== "FAILED" ? existing : undefined

    if (inFlight) {
      if (inFlight.competence !== request.competence) {
        throw new PaymentError("RECURRING_PAYMENT_IN_PROGRESS")
      }
      return await this.continueInFlight(recurring, inFlight, request)
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

    const method = this.resolveMethod(recurring, request)
    const amount = this.resolveAmount(recurring, request, method)
    // Everything that could make the payment unbookable is checked before the
    // provider is called: after the debit there is no way back, and a rejected
    // accounting entry would leave real money moved with no record of it.
    await this.assertExecutionPreconditions(recurring, request.competence)
    const account = await this.resolveAccount(churchId, request)
    const attempt = existing ? existing.attempt + 1 : 1
    const externalReference = this.externalReference(
      recurringPaymentId,
      request.competence,
      attempt
    )
    const currentPayment: CurrentRecurringPayment = {
      competence: request.competence,
      attempt,
      externalReference,
      amount,
      paymentMethod: method.type,
      executionDestination: this.destinationOf(method),
      bankId: account.bankId,
      availabilityAccountId: account.availabilityAccountId,
      status: "PROCESSING",
      providerStatus: "RESERVED",
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

    return await this.submit(recurring, currentPayment, method)
  }

  /**
   * An operation already exists for this competence. Nothing may start a second
   * one: a confirmed failure is the only state that resumes the workflow, and
   * even then the attempt number advances.
   */
  private async continueInFlight(
    recurring: RecurringPayments,
    payment: CurrentRecurringPayment,
    request: PayRecurringPaymentRequest
  ): Promise<ExecuteRecurringPaymentResult> {
    if (payment.status === "BLOCKED") {
      return this.result(payment)
    }

    if (
      payment.providerStatus === "DONE" ||
      payment.providerStatus === "PAID"
    ) {
      await this.registerRecord(recurring, payment)
      return this.result(payment)
    }

    if (payment.providerStatus !== "CREATION_UNKNOWN") {
      return this.result(payment)
    }

    const method = this.assertSameRetryPayload(recurring, payment, request)
    return await this.submit(recurring, payment, method)
  }

  /**
   * Validate that the payment can actually be booked once it happens: the
   * recurrence still points to an active OUTGO concept and a resolvable cost
   * center, and the financial month of the competence is open.
   */
  private async assertExecutionPreconditions(
    recurring: RecurringPayments,
    competence: string
  ): Promise<void> {
    const churchId = recurring.getChurchId()
    const [concept, costCenter] = await Promise.all([
      this.financialConceptRepository.one({
        financialConceptId: recurring.getFinancialConceptId(),
        churchId,
      }),
      this.financialConfigurationRepository.findCostCenterByCostCenterId(
        recurring.getCostCenterId(),
        churchId
      ),
    ])
    if (
      !concept ||
      concept.isDisable() ||
      concept.getType() !== ConceptType.OUTGO
    ) {
      throw new PaymentError("RECURRING_PAYMENT_FINANCIAL_CONCEPT_INVALID")
    }
    if (!costCenter) {
      throw new PaymentError("RECURRING_PAYMENT_COST_CENTER_INVALID")
    }

    const [year, month] = competence.split("-").map(Number)
    await new FinancialMonthValidator(this.financialYearRepository).validate({
      churchId,
      year,
      month,
    })
  }

  /**
   * FIXED amount comes from the configuration and must not be supplied again;
   * VARIABLE requires the amount for this competence. A BILL is the exception:
   * the boleto carries its own amount, so the caller is not asked for one and
   * the value read from the line becomes authoritative. One owner for the rule.
   */
  private resolveAmount(
    recurring: RecurringPayments,
    request: PayRecurringPaymentRequest,
    method: PayRecurringPaymentMethod
  ): number | undefined {
    const configuredAmount = recurring.getAmount()
    if (configuredAmount !== undefined) {
      if (request.amount !== undefined)
        throw new PaymentError("RECURRING_PAYMENT_AMOUNT_FORBIDDEN")
      return configuredAmount
    }
    // Nothing to declare: church-banking reads the amount from the boleto and
    // returns it, so asking the payer for it would be redundant and error-prone.
    if (method.type === "BILL" && request.amount === undefined) return undefined
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
    method: PayRecurringPaymentMethod
  ): Promise<ExecuteRecurringPaymentResult> {
    const context = {
      source: "RECURRING_PAYMENT",
      recurringPaymentId: recurring.getRecurringPaymentId(),
      competence: payment.competence,
      attempt: payment.attempt,
    }

    // A PIX transfer moves an exact amount, so it can never be undefined.
    const declaredAmount = payment.amount
    if (method.type === "PIX" && declaredAmount === undefined) {
      throw new PaymentError("RECURRING_PAYMENT_AMOUNT_REQUIRED")
    }

    let response: ChurchBankingOutgoingPaymentResponse
    try {
      if (method.type === "PIX") {
        response = await this.churchBankingClient.createPixTransfer({
          externalAccountId: recurring.getChurchId(),
          amountInCents: this.toCents(declaredAmount!),
          pixKey: method.pixKey,
          pixKeyType: method.pixKeyType,
          description: recurring.getName(),
          externalReference: payment.externalReference,
          context,
        })
      } else {
        response = await this.churchBankingClient.createBillPayment({
          externalAccountId: recurring.getChurchId(),
          identificationField: method.identificationField,
          description: recurring.getName(),
          externalReference: payment.externalReference,
          context,
          // Declared only when the amount is known up front, so a wrong amount
          // is refused before the debit. A boleto that defines its own amount
          // has nothing to compare against.
          ...(declaredAmount !== undefined
            ? { expectedAmountInCents: this.toCents(declaredAmount) }
            : {}),
        })
      }
    } catch (error) {
      const bankingError =
        error instanceof ChurchBankingClientError ? error : undefined
      const failure = bankingError?.isConfirmedRejection
        ? {
            status: "FAILED" as const,
            providerStatus: "CREATION_FAILED" as const,
            failureCode: bankingError.code,
          }
        : {
            status: "PROCESSING" as const,
            providerStatus: "CREATION_UNKNOWN" as const,
          }
      const next: CurrentRecurringPayment = {
        ...payment,
        ...failure,
        updatedAt: this.now(),
      }
      recurring.updateCurrentPayment(next)
      await this.recurringPaymentsRepository.saveIfCurrentPaymentMatches(
        recurring,
        payment
      )
      return this.result(next)
    }

    return this.applyBankingResult(recurring, payment, response)
  }

  private async applyBankingResult(
    recurring: RecurringPayments,
    payment: CurrentRecurringPayment,
    response: ChurchBankingOutgoingPaymentResponse
  ): Promise<ExecuteRecurringPaymentResult> {
    const status = response.status
    const providerValueInCents = response.valueInCents
    const expectedAmountInCents =
      payment.amount !== undefined ? this.toCents(payment.amount) : undefined

    // church-banking already refuses this before reaching the provider, so a
    // mismatch that arrives here means the amount the boleto charges differs
    // from the declared one. It is persisted instead of thrown — a thrown error
    // left the reservation in PROCESSING with nothing explaining it — and the UI
    // receives both amounts.
    //
    // Retriability depends on what the provider answered: only a confirmed
    // failure proves nothing was created. Any other status means an operation
    // may already exist at the bank, so the attempt must stay non-retriable;
    // marking it FAILED would let the next request reserve attempt 2 and create
    // a second charge for the same boleto.
    if (
      expectedAmountInCents !== undefined &&
      providerValueInCents !== undefined &&
      providerValueInCents !== expectedAmountInCents
    ) {
      const confirmedRejection =
        status === "FAILED" ||
        status === "CANCELLED" ||
        status === "CREATION_FAILED"
      const mismatched: CurrentRecurringPayment = {
        ...payment,
        status: confirmedRejection ? "FAILED" : "PROCESSING",
        providerStatus: confirmedRejection ? "CREATION_FAILED" : status,
        failureCode: "RECURRING_PAYMENT_BILL_AMOUNT_MISMATCH",
        providerValueInCents,
        updatedAt: this.now(),
      }
      recurring.updateCurrentPayment(mismatched)
      await this.recurringPaymentsRepository.saveIfCurrentPaymentMatches(
        recurring,
        payment
      )
      return this.result(mismatched)
    }

    const chargedAmount = this.chargedAmount(payment, response)
    const billed =
      providerValueInCents !== undefined ? { providerValueInCents } : {}

    if (status === "DONE" || status === "PAID") {
      const confirmed: CurrentRecurringPayment = {
        ...payment,
        ...(chargedAmount !== undefined ? { amount: chargedAmount } : {}),
        ...billed,
        status: "PROCESSING",
        providerStatus: status,
        ...(response.paymentDate ? { paymentDate: response.paymentDate } : {}),
        ...(response.transactionReceiptUrl
          ? { transactionReceiptUrl: response.transactionReceiptUrl }
          : {}),
        updatedAt: this.now(),
      }
      recurring.updateCurrentPayment(confirmed)
      await this.recurringPaymentsRepository.saveIfCurrentPaymentMatches(
        recurring,
        payment
      )
      await this.registerRecord(recurring, confirmed)
      return this.result(confirmed)
    }

    const failed =
      status === "FAILED" ||
      status === "CANCELLED" ||
      status === "CREATION_FAILED"
    const blocked = status === "BLOCKED"
    const next: CurrentRecurringPayment = {
      ...payment,
      // A boleto that defined its own amount now has a real one to carry.
      ...(chargedAmount !== undefined ? { amount: chargedAmount } : {}),
      ...billed,
      status: failed ? "FAILED" : blocked ? "BLOCKED" : "PROCESSING",
      providerStatus: status,
      ...(response.failureCode || response.errorCode
        ? { failureCode: response.failureCode ?? response.errorCode }
        : {}),
      ...(response.paymentDate ? { paymentDate: response.paymentDate } : {}),
      ...(response.transactionReceiptUrl
        ? { transactionReceiptUrl: response.transactionReceiptUrl }
        : {}),
      updatedAt: this.now(),
    }
    recurring.updateCurrentPayment(next)
    await this.recurringPaymentsRepository.saveIfCurrentPaymentMatches(
      recurring,
      payment
    )
    return this.result(next)
  }

  private async registerRecord(
    recurring: RecurringPayments,
    payment: CurrentRecurringPayment
  ): Promise<void> {
    const amount =
      payment.amount ??
      (payment.providerValueInCents !== undefined
        ? payment.providerValueInCents / 100
        : undefined)
    if (amount === undefined) {
      throw new PaymentError("RECURRING_PAYMENT_AMOUNT_REQUIRED")
    }

    await this.recordRegistrar.execute({
      recurring,
      competence: payment.competence,
      amount,
      availabilityAccountId: payment.availabilityAccountId,
      paymentDate: payment.paymentDate
        ? new Date(payment.paymentDate)
        : payment.updatedAt,
      createdBy: "system",
      bankingExternalReference: payment.externalReference,
      voucher: await this.storeReceipt(payment),
    })
  }

  /**
   * The bank is the one that issued the receipt, so it is also the one that
   * hands over a stored voucher. The application layer never sees the provider
   * receipt format.
   */
  private async storeReceipt(
    payment: CurrentRecurringPayment
  ): Promise<string | undefined> {
    if (!payment.transactionReceiptUrl) return undefined
    return await this.receiptStorage.storeRemoteReceipt(
      payment.externalReference,
      payment.transactionReceiptUrl
    )
  }

  /**
   * A retried creation-unknown must repeat the identical attempt: same amount,
   * same method payload and same account. A different payload would either
   * double-charge or be deduplicated by church-banking into a confusing answer.
   */
  private assertSameRetryPayload(
    recurring: RecurringPayments,
    payment: CurrentRecurringPayment,
    request: PayRecurringPaymentRequest
  ): PayRecurringPaymentMethod {
    const method = this.resolveMethod(recurring, request)
    const amount = this.resolveAmount(recurring, request, method)
    // church-banking requires byte-identical payee data for the same
    // externalReference, so a retry must repeat the exact destination.
    const sameDestination =
      payment.paymentMethod === method.type &&
      payment.executionDestination === this.destinationOf(method)
    if (
      amount !== payment.amount ||
      !sameDestination ||
      (request.availabilityAccountId !== undefined &&
        request.availabilityAccountId !== payment.availabilityAccountId)
    ) {
      throw new PaymentError("RECURRING_PAYMENT_IN_PROGRESS")
    }
    return method
  }

  private result(
    payment: CurrentRecurringPayment
  ): ExecuteRecurringPaymentResult {
    return {
      status: payment.status,
      competence: payment.competence,
      ...(payment.amount !== undefined ? { amount: payment.amount } : {}),
      ...(payment.providerValueInCents !== undefined
        ? { providerValueInCents: payment.providerValueInCents }
        : {}),
      ...(payment.failureCode ? { failureCode: payment.failureCode } : {}),
    }
  }

  /**
   * Amount this execution actually charges. A declared amount wins; otherwise
   * the boleto's own value does, which is the only way a BILL can be booked
   * without asking the payer to repeat what the line already says.
   */
  private chargedAmount(
    payment: CurrentRecurringPayment,
    response: ChurchBankingOutgoingPaymentResponse
  ): number | undefined {
    if (payment.amount !== undefined) return payment.amount
    if (response.valueInCents === undefined) return undefined
    return response.valueInCents / 100
  }

  /** The payee data that identifies this execution's target. */
  private destinationOf(method: PayRecurringPaymentMethod): string {
    return method.type === "PIX"
      ? `${method.pixKeyType}:${method.pixKey}`
      : method.identificationField
  }

  private externalReference(
    recurringPaymentId: string,
    competence: string,
    attempt: number
  ): string {
    return `urn:recurringPayment:${recurringPaymentId}:${competence}:${attempt}`
  }

  private toCents(amount: number): number {
    return Math.round(amount * 100)
  }
}
