import { ChurchBankingClientError } from "@/Banking/domain"
import type {
  ChurchBankingOutgoingPaymentResponse,
  IBankRepository,
  IChurchBankingClient,
} from "@/Banking/domain"
import type {
  IAvailabilityAccountRepository,
  IFinancialConceptRepository,
} from "@/FinanceConfig/domain"
import { ConceptType } from "@/FinanceConfig/domain/enums/ConcepType.enum"
import {
  type CurrentRecurringPayment,
  type IRecurringPaymentsRepository,
  type PayRecurringPaymentRequest,
  type RecurringPayments,
} from "@/Financial/domain"
import type { IQueueService } from "@/package/queue/domain"
import { QueueService } from "@/package/queue/infrastructure/QueueService"
import { AsaasReceiptStorage } from "@/Webhook/infrastructure/services/AsaasReceiptStorage"
import { RegisterRecurringPaymentFinancialRecord } from "./RegisterRecurringPaymentFinancialRecord"
import { RecurringPaymentException as PaymentError } from "@/Financial/domain/exceptions/RecurringPayment.exception"
import { assertCompetence } from "./RecurringPaymentCompetence"
import type { IFinancialRecordRepository } from "@/Financial/domain/interfaces"

export type ExecuteRecurringPaymentResult = {
  status: "PROCESSING" | "BLOCKED" | "FAILED" | "ALREADY_PAID"
  competence: string
  failureCode?: string
}

export class ExecuteRecurringPayment {
  private readonly recordRegistrar: RegisterRecurringPaymentFinancialRecord

  constructor(
    private readonly recurringPaymentsRepository: IRecurringPaymentsRepository,
    private readonly financialRecordRepository: IFinancialRecordRepository,
    private readonly financialConceptRepository: IFinancialConceptRepository,
    private readonly bankRepository: IBankRepository,
    private readonly availabilityAccountRepository: IAvailabilityAccountRepository,
    private readonly churchBankingClient: IChurchBankingClient,
    private readonly queueService: IQueueService = QueueService.getInstance(),
    private readonly receiptStorage = new AsaasReceiptStorage(),
    private readonly now: () => Date = () => new Date()
  ) {
    this.recordRegistrar = new RegisterRecurringPaymentFinancialRecord(
      financialRecordRepository,
      availabilityAccountRepository,
      queueService,
      receiptStorage
    )
  }

  async execute(
    churchId: string,
    recurringPaymentsId: string,
    request: PayRecurringPaymentRequest
  ): Promise<ExecuteRecurringPaymentResult> {
    assertCompetence(request.competence)
    const recurring = await this.recurringPaymentsRepository.one({
      recurringPaymentsId,
      churchId,
      status: "ACTIVE",
    })

    if (!recurring) {
      throw new PaymentError("RECURRING_PAYMENT_NOT_FOUND")
    }

    const alreadyPaid = await this.financialRecordRepository.one({
      recurringPaymentId: recurringPaymentsId,
      recurringCompetence: request.competence,
    })

    if (alreadyPaid)
      return { status: "ALREADY_PAID", competence: request.competence }

    const amount = this.resolveAmount(recurring, request)
    if (
      recurring.getPayment().method === "BILL" &&
      !request.identificationField?.trim()
    ) {
      throw new PaymentError("RECURRING_PAYMENT_BILL_CODE_REQUIRED")
    }
    if (
      recurring.getPayment().method === "PIX" &&
      request.identificationField !== undefined
    ) {
      throw new PaymentError("RECURRING_PAYMENT_INVALID")
    }
    const concept = await this.financialConceptRepository.one({
      financialConceptId: recurring.getFinancialConceptId(),
      churchId,
      active: true,
      type: ConceptType.OUTGO,
    })
    if (!concept) {
      throw new PaymentError("RECURRING_PAYMENT_FINANCIAL_CONCEPT_INVALID")
    }

    const existing = recurring.getCurrentPayment()
    if (existing && existing.status !== "FAILED") {
      if (existing.competence !== request.competence) {
        throw new PaymentError("RECURRING_PAYMENT_IN_PROGRESS")
      }
      if (existing.status === "BLOCKED") {
        return this.result(existing)
      }
      if (
        existing.providerStatus === "DONE" ||
        existing.providerStatus === "PAID"
      ) {
        await this.recordRegistrar.execute({
          recurring,
          payment: existing,
          concept,
          paymentDate: existing.paymentDate
            ? new Date(existing.paymentDate)
            : existing.updatedAt,
          transactionReceiptUrl: existing.transactionReceiptUrl,
        })
        return this.result(existing)
      }
      if (existing.providerStatus !== "CREATION_UNKNOWN") {
        return this.result(existing)
      }
      this.assertSameRetryPayload(existing, recurring, request, amount)
      return await this.submit(recurring, existing, concept)
    }

    const bank = await this.findConnectedAccount(churchId)
    const attempt =
      existing?.competence === request.competence ? existing.attempt + 1 : 1
    const externalReference = `urn:recurringPayment:${recurringPaymentsId}:${request.competence}:${attempt}`
    const currentPayment: CurrentRecurringPayment = {
      competence: request.competence,
      attempt,
      externalReference,
      amount,
      bankId: bank.bank.getBankId(),
      availabilityAccountId:
        bank.availabilityAccount.getAvailabilityAccountId(),
      status: "PROCESSING",
      providerStatus: "RESERVED",
      ...(request.identificationField
        ? { identificationField: request.identificationField }
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
        recurringPaymentsId,
      })
      const winningPayment = winner?.getCurrentPayment()
      if (winningPayment?.competence === request.competence)
        return this.result(winningPayment)
      throw new PaymentError("RECURRING_PAYMENT_IN_PROGRESS")
    }

    return await this.submit(recurring, currentPayment, concept)
  }

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

  private async findConnectedAccount(churchId: string) {
    const activeBanks = (await this.bankRepository.all(churchId)).filter(
      (bank) => bank.isActive()
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
    const matches = accounts.map((availabilityAccount) => {
      const bank = banksById.get(availabilityAccount.getSource()?.bankId)
      if (!bank) {
        throw new PaymentError("RECURRING_PAYMENT_BANK_ACCOUNT_UNAVAILABLE")
      }
      return { bank, availabilityAccount }
    })
    const [match, ...otherMatches] = matches
    if (!match || otherMatches.length > 0) {
      throw new PaymentError("RECURRING_PAYMENT_BANK_ACCOUNT_UNAVAILABLE")
    }
    return match
  }

  private async submit(
    recurring: RecurringPayments,
    payment: CurrentRecurringPayment,
    concept: NonNullable<
      Awaited<ReturnType<IFinancialConceptRepository["one"]>>
    >
  ): Promise<ExecuteRecurringPaymentResult> {
    const configuration = recurring.getPayment()
    const identificationField = payment.identificationField
    if (configuration.method === "BILL" && !identificationField) {
      throw new PaymentError("RECURRING_PAYMENT_BILL_CODE_REQUIRED")
    }

    const context = {
      source: "RECURRING_PAYMENT",
      recurringPaymentId: recurring.getRecurringPaymentsId(),
      competence: payment.competence,
      attempt: payment.attempt,
    }

    let response: ChurchBankingOutgoingPaymentResponse
    try {
      if (configuration.method === "PIX") {
        response = await this.churchBankingClient.createPixTransfer({
          externalAccountId: recurring.getChurchId(),
          amountInCents: this.toCents(payment.amount),
          pixKey: configuration.pixKey,
          pixKeyType: configuration.pixKeyType,
          description: recurring.getName(),
          externalReference: payment.externalReference,
          context,
        })
      } else {
        response = await this.churchBankingClient.createBillPayment({
          externalAccountId: recurring.getChurchId(),
          identificationField,
          description: recurring.getName(),
          externalReference: payment.externalReference,
          context,
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

    return this.applyBankingResult(recurring, payment, concept, response)
  }

  private async applyBankingResult(
    recurring: RecurringPayments,
    payment: CurrentRecurringPayment,
    concept: NonNullable<
      Awaited<ReturnType<IFinancialConceptRepository["one"]>>
    >,
    response: Awaited<ReturnType<IChurchBankingClient["createPixTransfer"]>>
  ): Promise<ExecuteRecurringPaymentResult> {
    const status = response.status
    if (status === "DONE" || status === "PAID") {
      const confirmed: CurrentRecurringPayment = {
        ...payment,
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
      await this.recordRegistrar.execute({
        recurring,
        payment: confirmed,
        concept,
        paymentDate: response.paymentDate
          ? new Date(response.paymentDate)
          : this.now(),
        transactionReceiptUrl: response.transactionReceiptUrl,
      })
      return this.result(payment)
    }
    const failed =
      status === "FAILED" ||
      status === "CANCELLED" ||
      status === "CREATION_FAILED"
    const blocked = status === "BLOCKED"
    const next: CurrentRecurringPayment = {
      ...payment,
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

  private assertSameRetryPayload(
    payment: CurrentRecurringPayment,
    recurring: RecurringPayments,
    request: PayRecurringPaymentRequest,
    amount: number
  ): void {
    if (
      amount !== payment.amount ||
      (recurring.getPayment().method === "BILL" &&
        request.identificationField !== payment.identificationField)
    ) {
      throw new PaymentError("RECURRING_PAYMENT_IN_PROGRESS")
    }
  }

  private result(
    payment: CurrentRecurringPayment
  ): ExecuteRecurringPaymentResult {
    return {
      status: payment.status,
      competence: payment.competence,
      ...(payment.failureCode ? { failureCode: payment.failureCode } : {}),
    }
  }

  private toCents(amount: number): number {
    return Math.round(amount * 100)
  }
}
