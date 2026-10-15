import { createHash } from "node:crypto"
import type { IAvailabilityAccountRepository } from "@/FinanceConfig/domain/interfaces/AvailabilityAccountRepository.interface"
import type { IFinancialConceptRepository } from "@/FinanceConfig/domain/interfaces/FinancialConceptRepository.interface"
import type { IFinancialConfigurationRepository } from "@/FinanceConfig/domain/interfaces/FinancialConfigurationRepository.interface"
import { ConceptType } from "@/FinanceConfig/domain/enums/ConcepType.enum"
import {
  FinancialRecordSource,
  FinancialRecordStatus,
  FinancialRecordType,
} from "@/Financial/domain/enums/FinancialRecordType.enum"
import type { RecurringPayments } from "@/Financial/domain/RecurringPayments"
import type { IFinancialRecordRepository } from "@/Financial/domain/interfaces/FinancialRecordRepository.interface"
import { DispatchCreateFinancialRecord } from "@/Financial/applications/dispatchers/DispatchCreateFinancialRecord"
import type { IQueueService } from "@/package/queue/domain"
import { QueueService } from "@/package/queue/infrastructure/QueueService"
import { RecurringPaymentException } from "@/Financial/domain/exceptions/RecurringPayment.exception"

export type RegisterRecurringPaymentFinancialRecordInput = {
  readonly recurring: RecurringPayments
  readonly competence: string
  readonly amount: number
  readonly availabilityAccountId: string
  readonly paymentDate: Date
  readonly createdBy: string
  /** Present for a banking execution; absent for a manual one. */
  readonly bankingExternalReference?: string
  /**
   * Already-stored voucher key. Uploading the file is the caller's job, so this
   * use case needs no knowledge of where or how the document was obtained.
   */
  readonly voucher?: string
}

/**
 * The single point where a recurring payment becomes accounting history.
 *
 * Both execution paths converge here; only the settlement status differs:
 * a payment executed through church-banking is settled (`CLEARED`), while a
 * manual registration still needs bank reconciliation (`PENDING`).
 *
 * Concept and cost center are resolved from the recurrence, never accepted from
 * the caller, so accounting imputation cannot be forged per execution.
 */
export class RegisterRecurringPaymentFinancialRecord {
  constructor(
    private readonly financialRecordRepository: IFinancialRecordRepository,
    private readonly availabilityAccountRepository: IAvailabilityAccountRepository,
    private readonly financialConceptRepository: IFinancialConceptRepository,
    private readonly financialConfigurationRepository: IFinancialConfigurationRepository,
    private readonly queueService: IQueueService = QueueService.getInstance()
  ) {}

  async execute(
    input: RegisterRecurringPaymentFinancialRecordInput
  ): Promise<void> {
    const {
      recurring,
      competence,
      amount,
      availabilityAccountId,
      paymentDate,
      createdBy,
      bankingExternalReference,
      voucher,
    } = input

    const exists = await this.financialRecordRepository.findRecurringPayment(
      recurring.getRecurringPaymentId(),
      competence
    )
    if (exists) return

    const churchId = recurring.getChurchId()
    const [account, concept, costCenter] = await Promise.all([
      this.availabilityAccountRepository.one({
        availabilityAccountId,
        churchId,
      }),
      this.financialConceptRepository.one({
        financialConceptId: recurring.getFinancialConceptId(),
        churchId,
        active: true,
        type: ConceptType.OUTGO,
      }),
      this.financialConfigurationRepository.findCostCenterByCostCenterId(
        recurring.getCostCenterId(),
        churchId
      ),
    ])

    if (!account) {
      throw new RecurringPaymentException(
        "RECURRING_PAYMENT_AVAILABILITY_ACCOUNT_UNAVAILABLE"
      )
    }
    if (!concept) {
      throw new RecurringPaymentException(
        "RECURRING_PAYMENT_FINANCIAL_CONCEPT_INVALID"
      )
    }
    if (!costCenter) {
      throw new RecurringPaymentException(
        "RECURRING_PAYMENT_COST_CENTER_INVALID"
      )
    }

    const digest = this.digest(recurring.getRecurringPaymentId(), competence)
    await new DispatchCreateFinancialRecord(this.queueService).execute(
      {
        financialRecordId: `urn:financialRecord:${digest}`,
        churchId,
        amount,
        description: recurring.getName(),
        date: paymentDate,
        financialRecordType: FinancialRecordType.OUTGO,
        source: bankingExternalReference
          ? FinancialRecordSource.AUTO
          : FinancialRecordSource.MANUAL,
        status: bankingExternalReference
          ? FinancialRecordStatus.CLEARED
          : FinancialRecordStatus.PENDING,
        financialConcept: concept,
        costCenter,
        availabilityAccount: account,
        createdBy,
        voucher,
        reference: {
          type: "RECURRING_PAYMENT",
          entityId: recurring.getRecurringPaymentId(),
        },
        recurringPaymentId: recurring.getRecurringPaymentId(),
        recurringCompetence: competence,
        ...(bankingExternalReference ? { bankingExternalReference } : {}),
      },
      { jobId: `recurring-${digest}` }
    )
  }

  /**
   * Deterministic identity for one competence, so the queued job and the record
   * itself are deduplicated even before the unique index is consulted.
   */
  private digest(recurringPaymentId: string, competence: string): string {
    return createHash("sha256")
      .update(`${recurringPaymentId}:${competence}`)
      .digest("hex")
  }
}
