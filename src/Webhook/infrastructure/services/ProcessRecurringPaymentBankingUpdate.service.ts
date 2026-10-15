import type { IAvailabilityAccountRepository } from "@/FinanceConfig/domain/interfaces/AvailabilityAccountRepository.interface"
import type { IFinancialConceptRepository } from "@/FinanceConfig/domain/interfaces/FinancialConceptRepository.interface"
import type { IFinancialConfigurationRepository } from "@/FinanceConfig/domain/interfaces/FinancialConfigurationRepository.interface"
import type { CurrentRecurringPayment } from "@/Financial/domain/RecurringPayments"
import type { IFinancialRecordRepository } from "@/Financial/domain/interfaces/FinancialRecordRepository.interface"
import type { IRecurringPaymentsRepository } from "@/Financial/domain/interfaces/RecurringPaymentsRepository.interface"
import { RecurringPaymentException } from "@/Financial/domain/exceptions/RecurringPayment.exception"
import { RecurringPaymentException as PaymentError } from "@/Financial/domain/exceptions/RecurringPayment.exception"
import { RecurringPaymentsMongoRepository } from "@/Financial/infrastructure/persistence/RecurringPaymentsMongoRepository"
import { FinanceRecordMongoRepository } from "@/Financial/infrastructure/persistence/FinanceRecordMongoRepository"
import { FinancialConceptMongoRepository } from "@/FinanceConfig/infrastructure/presistence/FinancialConceptMongoRepository"
import { FinancialConfigurationMongoRepository } from "@/FinanceConfig/infrastructure/presistence/FinancialConfigurationMongoRepository"
import { AvailabilityAccountMongoRepository } from "@/FinanceConfig/infrastructure/presistence/AvailabilityAccountMongoRepository"
import { QueueService } from "@/package/queue/infrastructure/QueueService"
import type { IQueueService } from "@/package/queue/domain"
import { Logger } from "@/Shared/adapter/CustomLogger"
import type { IRemoteReceiptStorage } from "@/Financial/domain/interfaces/RemoteReceiptStorage.interface"
import { AsaasReceiptStorage } from "./AsaasReceiptStorage"
import { RegisterRecurringPaymentFinancialRecord } from "@/Financial/applications/recurringPayments/RegisterRecurringPaymentFinancialRecord"

export type PixTransferUpdatedEvent = {
  id: string
  occurredAt: string
  externalAccountId: string
  accountId: string
  data: {
    pixTransfer: {
      providerTransferId: string
      status: string
      amountInCents: number
      externalReference: string
      context: Record<string, unknown>
      transactionReceiptUrl: string | null
      failureCode: string | null
    }
  }
}

export type BillPaymentUpdatedEvent = {
  id: string
  occurredAt: string
  externalAccountId: string
  accountId: string
  data: {
    billPayment: {
      providerBillId: string
      status: string
      externalReference: string
      context: Record<string, unknown>
      paymentDate: string | null
      transactionReceiptUrl: string | null
      failureCode: string | null
    }
  }
}

export class ProcessRecurringPaymentBankingUpdate {
  private readonly logger = Logger(ProcessRecurringPaymentBankingUpdate.name)
  private readonly recordRegistrar: RegisterRecurringPaymentFinancialRecord

  constructor(
    private readonly recurringRepository: IRecurringPaymentsRepository = RecurringPaymentsMongoRepository.getInstance(),
    private readonly financialRecordRepository: IFinancialRecordRepository = FinanceRecordMongoRepository.getInstance(),
    private readonly conceptRepository: IFinancialConceptRepository = FinancialConceptMongoRepository.getInstance(),
    private readonly availabilityAccountRepository: IAvailabilityAccountRepository = AvailabilityAccountMongoRepository.getInstance(),
    private readonly financialConfigurationRepository: IFinancialConfigurationRepository = FinancialConfigurationMongoRepository.getInstance(),
    private readonly queueService: IQueueService = QueueService.getInstance(),
    private readonly receiptStorage: IRemoteReceiptStorage = new AsaasReceiptStorage(),
    private readonly now: () => Date = () => new Date()
  ) {
    this.recordRegistrar = new RegisterRecurringPaymentFinancialRecord(
      financialRecordRepository,
      availabilityAccountRepository,
      conceptRepository,
      financialConfigurationRepository,
      queueService
    )
  }

  async processPix(event: PixTransferUpdatedEvent): Promise<void> {
    const transfer = event.data.pixTransfer
    const record =
      await this.financialRecordRepository.findByBankingExternalReference(
        transfer.externalReference
      )
    if (record) {
      this.assertDuplicateContext(
        record.getChurchId(),
        record.getRecurringPaymentId(),
        record.getReference()?.type === "RECURRING_PAYMENT"
          ? record.getReference()?.entityId
          : undefined,
        transfer.externalReference,
        transfer.context,
        event.externalAccountId
      )
      if (transfer.status === "REFUNDED")
        this.logRefund(
          record.getRecurringPaymentId() ?? "",
          transfer.externalReference
        )
      return
    }
    const recurring = await this.findOperation(
      event.externalAccountId,
      event.accountId,
      transfer.externalReference,
      transfer.context
    )
    const payment = recurring.getCurrentPayment()
    if (!payment)
      throw new PaymentError("RECURRING_PAYMENT_BANKING_REFERENCE_MISMATCH")
    if (Math.round(payment.amount * 100) !== transfer.amountInCents) {
      throw new PaymentError("RECURRING_PAYMENT_BANKING_REFERENCE_MISMATCH")
    }
    if (transfer.status === "DONE") {
      const paymentDate = new Date(event.occurredAt)
      if (Number.isNaN(paymentDate.getTime()))
        throw new PaymentError("RECURRING_PAYMENT_BANKING_REFERENCE_MISMATCH")
      await this.recordConfirmed(
        recurring,
        payment,
        transfer.transactionReceiptUrl,
        paymentDate,
        "DONE"
      )
      return
    }
    if (transfer.status === "REFUNDED") {
      this.logger.info(
        "Recognized recurring PIX refund; accounting reversal requires a business rule",
        {
          recurringPaymentId: recurring.getRecurringPaymentId(),
          competence: payment.competence,
          externalReference: transfer.externalReference,
        }
      )
      return
    }
    await this.applyStatus(recurring, payment, {
      providerStatus: transfer.status,
      failureCode: transfer.failureCode ?? undefined,
      transactionReceiptUrl: transfer.transactionReceiptUrl ?? undefined,
    })
  }

  async processBill(event: BillPaymentUpdatedEvent): Promise<void> {
    const bill = event.data.billPayment
    const record =
      await this.financialRecordRepository.findByBankingExternalReference(
        bill.externalReference
      )
    if (record) {
      this.assertDuplicateContext(
        record.getChurchId(),
        record.getRecurringPaymentId(),
        record.getReference()?.type === "RECURRING_PAYMENT"
          ? record.getReference()?.entityId
          : undefined,
        bill.externalReference,
        bill.context,
        event.externalAccountId
      )
      if (bill.status === "REFUNDED")
        this.logRefund(
          record.getRecurringPaymentId() ?? "",
          bill.externalReference
        )
      return
    }
    const recurring = await this.findOperation(
      event.externalAccountId,
      event.accountId,
      bill.externalReference,
      bill.context
    )
    const payment = recurring.getCurrentPayment()
    if (!payment)
      throw new PaymentError("RECURRING_PAYMENT_BANKING_REFERENCE_MISMATCH")
    if (bill.status === "PAID") {
      const paymentDate = bill.paymentDate
        ? new Date(bill.paymentDate)
        : new Date(event.occurredAt)
      if (Number.isNaN(paymentDate.getTime()))
        throw new PaymentError("RECURRING_PAYMENT_BANKING_REFERENCE_MISMATCH")
      await this.recordConfirmed(
        recurring,
        payment,
        bill.transactionReceiptUrl,
        paymentDate,
        "PAID"
      )
      return
    }
    if (bill.status === "REFUNDED") {
      this.logRefund(recurring.getRecurringPaymentId(), bill.externalReference)
      return
    }
    await this.applyStatus(recurring, payment, {
      providerStatus: bill.status,
      failureCode: bill.failureCode ?? undefined,
      paymentDate: bill.paymentDate ?? undefined,
      transactionReceiptUrl: bill.transactionReceiptUrl ?? undefined,
    })
  }

  private async findOperation(
    externalAccountId: string,
    accountId: string,
    externalReference: string,
    context: Record<string, unknown>
  ) {
    const recurring = await this.recurringRepository.one({
      "currentPayment.externalReference": externalReference,
    })
    const payment = recurring?.getCurrentPayment()
    if (
      !recurring ||
      !payment ||
      recurring.getChurchId() !== externalAccountId ||
      payment.bankId !== accountId ||
      context.source !== "RECURRING_PAYMENT" ||
      context.recurringPaymentId !== recurring.getRecurringPaymentId() ||
      context.competence !== payment.competence ||
      context.attempt !== payment.attempt ||
      externalReference !==
        `urn:recurringPayment:${recurring.getRecurringPaymentId()}:${payment.competence}:${payment.attempt}`
    ) {
      throw new PaymentError("RECURRING_PAYMENT_BANKING_REFERENCE_MISMATCH")
    }
    return recurring
  }

  private assertDuplicateContext(
    churchId: string,
    recurringPaymentId: string | undefined,
    referenceEntityId: string | undefined,
    externalReference: string,
    context: Record<string, unknown>,
    eventChurchId: string
  ): void {
    const competence = context.competence
    if (
      !recurringPaymentId ||
      referenceEntityId !== recurringPaymentId ||
      churchId !== eventChurchId ||
      context.source !== "RECURRING_PAYMENT" ||
      context.recurringPaymentId !== recurringPaymentId ||
      typeof competence !== "string" ||
      !new RegExp(
        `^urn:recurringPayment:${escapeRegExp(recurringPaymentId)}:${escapeRegExp(competence)}:\\d+$`
      ).test(externalReference)
    ) {
      throw new PaymentError("RECURRING_PAYMENT_BANKING_REFERENCE_MISMATCH")
    }
  }

  private async recordConfirmed(
    recurring: NonNullable<
      Awaited<ReturnType<IRecurringPaymentsRepository["one"]>>
    >,
    payment: CurrentRecurringPayment,
    receiptUrl: string | null,
    paymentDate: Date,
    providerStatus: "DONE" | "PAID"
  ): Promise<void> {
    const record = await this.financialRecordRepository.findRecurringPayment(
      recurring.getRecurringPaymentId(),
      payment.competence
    )
    if (record) {
      recurring.closeCurrentPayment(payment.externalReference)
      await this.recurringRepository.saveIfCurrentPaymentMatches(
        recurring,
        payment
      )
      return
    }
    const confirmed: CurrentRecurringPayment = {
      ...payment,
      status: "PROCESSING",
      providerStatus,
      ...(receiptUrl ? { transactionReceiptUrl: receiptUrl } : {}),
      updatedAt: this.now(),
    }
    recurring.updateCurrentPayment(confirmed)
    await this.recurringRepository.saveIfCurrentPaymentMatches(
      recurring,
      payment
    )
    // Concept and cost center are resolved inside the registrar from the
    // recurrence, so the same rules apply to banking and manual execution.
    await this.recordRegistrar.execute({
      recurring,
      competence: confirmed.competence,
      amount: confirmed.amount,
      availabilityAccountId: confirmed.availabilityAccountId,
      paymentDate,
      createdBy: "system",
      bankingExternalReference: confirmed.externalReference,
      voucher: await this.storeReceipt(confirmed.externalReference, receiptUrl),
    })
  }

  /**
   * The provider receipt is fetched and stored here, at the integration
   * boundary, so the application layer only ever receives a stored voucher key.
   */
  private async storeReceipt(
    externalReference: string,
    receiptUrl: string | null
  ): Promise<string | undefined> {
    if (!receiptUrl) return undefined
    return await this.receiptStorage.storeRemoteReceipt(
      externalReference,
      receiptUrl
    )
  }

  private async applyStatus(
    recurring: NonNullable<
      Awaited<ReturnType<IRecurringPaymentsRepository["one"]>>
    >,
    current: CurrentRecurringPayment,
    update: Pick<CurrentRecurringPayment, "providerStatus"> &
      Partial<
        Pick<
          CurrentRecurringPayment,
          "failureCode" | "paymentDate" | "transactionReceiptUrl"
        >
      >
  ): Promise<void> {
    if (current.providerStatus === "DONE" || current.providerStatus === "PAID")
      return
    const failed = ["FAILED", "CANCELLED", "CREATION_FAILED"].includes(
      update.providerStatus
    )
    const blocked = update.providerStatus === "BLOCKED"
    const processing = [
      "PENDING",
      "IN_BANK_PROCESSING",
      "BANK_PROCESSING",
      "CREATING",
      "CREATION_UNKNOWN",
    ].includes(update.providerStatus)
    if (!failed && !blocked && !processing) {
      throw new PaymentError("RECURRING_PAYMENT_BANKING_REFERENCE_MISMATCH")
    }
    recurring.updateCurrentPayment({
      ...current,
      ...update,
      status: failed ? "FAILED" : blocked ? "BLOCKED" : "PROCESSING",
      updatedAt: this.now(),
    })
    await this.recurringRepository.saveIfCurrentPaymentMatches(
      recurring,
      current
    )
  }

  private logRefund(
    recurringPaymentId: string,
    externalReference: string
  ): void {
    this.logger.info(
      "Recognized recurring bill refund; accounting reversal requires a business rule",
      {
        recurringPaymentId,
        externalReference,
      }
    )
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
