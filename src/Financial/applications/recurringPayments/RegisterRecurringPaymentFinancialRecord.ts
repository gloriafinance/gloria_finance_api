import { createHash } from "node:crypto"
import type {
  IAvailabilityAccountRepository,
  IFinancialConceptRepository,
} from "@/FinanceConfig/domain"
import { FinancialRecord } from "@/Financial/domain/FinanceRecord"
import {
  FinancialRecordSource,
  FinancialRecordStatus,
  FinancialRecordType,
} from "@/Financial/domain/enums/FinancialRecordType.enum"
import type {
  CurrentRecurringPayment,
  RecurringPayments,
} from "@/Financial/domain/RecurringPayments"
import type { IFinancialRecordRepository } from "@/Financial/domain/interfaces/FinancialRecordRepository.interface"
import { DispatchCreateFinancialRecord } from "@/Financial/applications/dispatchers/DispatchCreateFinancialRecord"
import type { IQueueService } from "@/package/queue/domain"
import { QueueService } from "@/package/queue/infrastructure/QueueService"
import { AsaasReceiptStorage } from "@/Webhook/infrastructure/services/AsaasReceiptStorage"
import { RecurringPaymentException } from "@/Financial/domain/exceptions/RecurringPayment.exception"

export class RegisterRecurringPaymentFinancialRecord {
  constructor(
    private readonly financialRecordRepository: IFinancialRecordRepository,
    private readonly availabilityAccountRepository: IAvailabilityAccountRepository,
    private readonly queueService: IQueueService = QueueService.getInstance(),
    private readonly receiptStorage = new AsaasReceiptStorage()
  ) {}

  async execute(input: {
    readonly recurring: RecurringPayments
    readonly payment: CurrentRecurringPayment
    readonly concept: NonNullable<
      Awaited<ReturnType<IFinancialConceptRepository["one"]>>
    >
    readonly paymentDate: Date
    readonly transactionReceiptUrl?: string | null
  }): Promise<void> {
    const { recurring, payment, concept, paymentDate, transactionReceiptUrl } =
      input
    const exists = await this.financialRecordRepository.findRecurringPayment(
      recurring.getRecurringPaymentsId(),
      payment.competence
    )
    if (exists) return

    const account = await this.availabilityAccountRepository.one({
      availabilityAccountId: payment.availabilityAccountId,
      churchId: recurring.getChurchId(),
    })
    if (!account) {
      throw new RecurringPaymentException(
        "RECURRING_PAYMENT_BANK_ACCOUNT_UNAVAILABLE"
      )
    }
    const voucher = transactionReceiptUrl
      ? await this.receiptStorage.save(
          payment.externalReference,
          transactionReceiptUrl
        )
      : undefined
    const digest = createHash("sha256")
      .update(payment.externalReference)
      .digest("hex")
    await new DispatchCreateFinancialRecord(this.queueService).execute(
      {
        financialRecordId: `urn:financialRecord:${digest}`,
        churchId: recurring.getChurchId(),
        amount: payment.amount,
        description: recurring.getName(),
        date: paymentDate,
        financialRecordType: FinancialRecordType.OUTGO,
        source: FinancialRecordSource.AUTO,
        status: FinancialRecordStatus.RECONCILED,
        financialConcept: concept,
        availabilityAccount: account,
        createdBy: "system",
        voucher,
        reference: {
          type: "RECURRING_PAYMENT",
          entityId: recurring.getRecurringPaymentsId(),
        },
        recurringPaymentId: recurring.getRecurringPaymentsId(),
        recurringCompetence: payment.competence,
        bankingExternalReference: payment.externalReference,
      },
      { jobId: `recurring-${digest}` }
    )
  }
}
