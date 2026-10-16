import type {
  CurrentRecurringPayment,
  RecurringPaymentExecutionStatus,
} from "@/Financial/domain/RecurringPayments"
import type { IFinancialRecordRepository } from "@/Financial/domain/interfaces/FinancialRecordRepository.interface"
import type { IRecurringPaymentsRepository } from "@/Financial/domain/interfaces/RecurringPaymentsRepository.interface"
import { RecurringPaymentException as PaymentError } from "@/Financial/domain/exceptions/RecurringPayment.exception"
import { RecurringPaymentsMongoRepository } from "@/Financial/infrastructure/persistence/RecurringPaymentsMongoRepository"
import { FinanceRecordMongoRepository } from "@/Financial/infrastructure/persistence/FinanceRecordMongoRepository"
import { FinancialConceptMongoRepository } from "@/FinanceConfig/infrastructure/presistence/FinancialConceptMongoRepository"
import { FinancialConfigurationMongoRepository } from "@/FinanceConfig/infrastructure/presistence/FinancialConfigurationMongoRepository"
import { AvailabilityAccountMongoRepository } from "@/FinanceConfig/infrastructure/presistence/AvailabilityAccountMongoRepository"
import { QueueService } from "@/package/queue/infrastructure/QueueService"
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
      /**
       * Amount the boleto charges, read from the identification field by
       * church-banking. It is the only proof of what was actually debited, so a
       * PAID bill is rejected when it disagrees with the recorded amount.
       */
      valueInCents: number
      context: Record<string, unknown>
      paymentDate: string | null
      transactionReceiptUrl: string | null
      failureCode: string | null
    }
  }
}

/** Provider outcomes that must never be undone by a later, earlier-looking event. */
/** A paid or failed execution is terminal: nothing may undo it. */
const RECURRING_TERMINAL_STATUSES = new Set(["PAID", "FAILED"])

export class ProcessRecurringPaymentBankingUpdate {
  private readonly logger = Logger(ProcessRecurringPaymentBankingUpdate.name)
  private readonly recordRegistrar: RegisterRecurringPaymentFinancialRecord

  constructor(
    private readonly recurringRepository: IRecurringPaymentsRepository = RecurringPaymentsMongoRepository.getInstance(),
    private readonly financialRecordRepository: IFinancialRecordRepository = FinanceRecordMongoRepository.getInstance(),
    private readonly receiptStorage: IRemoteReceiptStorage = new AsaasReceiptStorage(),
    private readonly now: () => Date = () => new Date()
  ) {
    this.recordRegistrar = new RegisterRecurringPaymentFinancialRecord(
      financialRecordRepository,
      AvailabilityAccountMongoRepository.getInstance(),
      FinancialConceptMongoRepository.getInstance(),
      FinancialConfigurationMongoRepository.getInstance(),
      QueueService.getInstance()
    )
  }

  async processPix(event: PixTransferUpdatedEvent): Promise<void> {
    const transfer = event.data.pixTransfer
    const record = await this.financialRecordRepository.one({
      bankingExternalReference: transfer.externalReference,
    })

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
        paymentDate
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
      status: canonicalStatusOf(transfer.status),
      transactionReceiptUrl: transfer.transactionReceiptUrl ?? undefined,
    })
  }

  async processBill(event: BillPaymentUpdatedEvent): Promise<void> {
    const bill = event.data.billPayment
    const record = await this.financialRecordRepository.one({
      bankingExternalReference: bill.externalReference,
    })

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
      bill.externalReference,
      bill.context
    )
    const payment = recurring.getCurrentPayment()
    if (!payment)
      throw new PaymentError("RECURRING_PAYMENT_BANKING_REFERENCE_MISMATCH")
    if (bill.status === "PAID") {
      // A bill is executed for whatever the boleto charges, which is independent
      // of the amount the church typed. Recording the local amount without
      // checking it would book an expense the bank never paid, so a declared
      // amount that differs is refused.
      const reservedAmountInCents =
        payment.amount !== undefined
          ? Math.round(payment.amount * 100)
          : undefined
      if (
        reservedAmountInCents !== undefined &&
        reservedAmountInCents !== bill.valueInCents
      ) {
        throw new PaymentError("RECURRING_PAYMENT_BILL_AMOUNT_MISMATCH")
      }
      const paymentDate = bill.paymentDate
        ? new Date(bill.paymentDate)
        : new Date(event.occurredAt)
      if (Number.isNaN(paymentDate.getTime()))
        throw new PaymentError("RECURRING_PAYMENT_BANKING_REFERENCE_MISMATCH")
      await this.recordConfirmed(
        recurring,
        // The billed amount is authoritative: a reservation that never knew the
        // amount still has to book what the bank actually paid.
        { ...payment, amount: bill.valueInCents / 100 },
        bill.transactionReceiptUrl,
        paymentDate
      )
      return
    }
    if (bill.status === "REFUNDED") {
      this.logRefund(recurring.getRecurringPaymentId(), bill.externalReference)
      return
    }
    await this.applyStatus(recurring, payment, {
      status: canonicalStatusOf(bill.status),
      paymentDate: bill.paymentDate ?? undefined,
      transactionReceiptUrl: bill.transactionReceiptUrl ?? undefined,
    })
  }

  private async findOperation(
    externalAccountId: string,
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
      context.source !== "RECURRING_PAYMENT" ||
      context.recurringPaymentId !== recurring.getRecurringPaymentId() ||
      context.competence !== payment.competence ||
      externalReference !==
        `urn:recurringPayment:${recurring.getRecurringPaymentId()}:${payment.competence}`
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
      // The reference is stable per competence now, so a duplicate confirmation
      // has to match it exactly: requiring a suffix would reject every duplicate.
      !new RegExp(
        `^urn:recurringPayment:${escapeRegExp(recurringPaymentId)}:${escapeRegExp(competence)}$`
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
    paymentDate: Date
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
      status: "PAID",
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
    update: Pick<CurrentRecurringPayment, "status"> &
      Partial<
        Pick<CurrentRecurringPayment, "paymentDate" | "transactionReceiptUrl">
      >
  ): Promise<void> {
    // A paid execution is final: a late in-flight event cannot undo it.
    if (current.status === "PAID") return
    recurring.updateCurrentPayment({
      ...current,
      ...update,
      updatedAt: this.now(),
    })
    const saved = await this.recurringRepository.saveIfCurrentPaymentMatches(
      recurring,
      current
    )
    if (saved) return

    // Another writer won the race. Dropping the update could lose a terminal
    // outcome with no further event to correct it, so the durable state is
    // reloaded and the change re-applied unless it is already superseded.
    // The caller already hands over the canonical status, so the lost-CAS retry
    // re-applies exactly the same update.
    await this.reapplyAfterLostCas(recurring.getRecurringPaymentId(), update)
  }

  /**
   * Re-applies a status update that lost a CAS race.
   *
   * Precedence is monotonic: a terminal provider outcome is never overwritten by
   * a non-terminal one, so a late PENDING cannot undo a DONE or a FAILED.
   */
  private async reapplyAfterLostCas(
    recurringPaymentId: string,
    update: Pick<
      CurrentRecurringPayment,
      "status" | "paymentDate" | "transactionReceiptUrl"
    >
  ): Promise<void> {
    const winner = await this.recurringRepository.one({ recurringPaymentId })
    const current = winner?.getCurrentPayment()
    if (!winner || !current) {
      throw new PaymentError("RECURRING_PAYMENT_BANKING_REFERENCE_MISMATCH")
    }
    if (
      RECURRING_TERMINAL_STATUSES.has(current.status) &&
      !RECURRING_TERMINAL_STATUSES.has(update.status)
    ) {
      return
    }
    winner.updateCurrentPayment({
      ...current,
      ...update,
      updatedAt: this.now(),
    } as CurrentRecurringPayment)
    const applied = await this.recurringRepository.saveIfCurrentPaymentMatches(
      winner,
      current
    )
    if (!applied) {
      this.logger.error("Recurring payment status lost the CAS twice", {
        recurringPaymentId,
        status: update.status,
      })
    }
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

/**
 * church-banking already normalizes its provider's vocabulary. This is the last
 * step that turns its answer into this service's own states, so the domain never
 * sees a provider string.
 */
function canonicalStatusOf(status: string): RecurringPaymentExecutionStatus {
  if (status === "PAID" || status === "DONE") return "PAID"
  if (status === "BLOCKED") return "BLOCKED"
  if (["FAILED", "CANCELLED", "REFUNDED", "CREATION_FAILED"].includes(status))
    return "FAILED"
  return "PROCESSING"
}
