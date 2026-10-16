import { FinancialMonthValidator } from "@/ConsolidatedFinancial/applications"
import type { IFinancialYearRepository } from "@/ConsolidatedFinancial/domain"
import {
  DispatchUpdateAvailabilityAccountBalance,
  DispatchUpdateCostCenterMaster,
} from "@/Financial/applications"
import {
  AvailabilityAccount,
  ConceptType,
  CostCenter,
  FinanceRecord,
  FinancialConcept,
  type FinancialRecordCreateQueue,
  FinancialRecordStatus,
  TypeOperationMoney,
} from "@/Financial/domain"
import type { IFinancialRecordRepository } from "@/Financial/domain/interfaces"
import type { IRecurringPaymentsRepository } from "@/Financial/domain/interfaces/RecurringPaymentsRepository.interface.ts"
import type { IJob, IQueueService } from "@/package/queue/domain"
import { Logger } from "@/Shared/adapter"
import type { IStorageService } from "@/Shared/domain"
import type { IDRERepository } from "@/Reports/domain/interfaces/DRERepository.interface"
import { DREMongoRepository } from "@/Reports/infrastructure/persistence/DREMongoRepository"

export class CreateFinancialRecordJob implements IJob {
  private logger = Logger(CreateFinancialRecordJob.name)

  constructor(
    private readonly financialYearRepository: IFinancialYearRepository,
    private readonly financialRecordRepository: IFinancialRecordRepository,
    private readonly store: IStorageService,
    private readonly queueService: IQueueService,
    private readonly recurringPaymentsRepository?: IRecurringPaymentsRepository,
    /**
     * A late booking invalidates the period's materialized report so it is
     * recomputed instead of staying wrong.
     */
    private readonly dreRepository: Pick<
      IDRERepository,
      "invalidate"
    > = DREMongoRepository.getInstance()
  ) {}

  async handle(args: FinancialRecordCreateQueue): Promise<void> {
    this.logger.info(`CreateFinancialRecord`, {
      ...args,
      jobName: CreateFinancialRecordJob.name,
    })

    // A recurring execution is booked in the competence it settles, which is the
    // period the caller already validated. Using the payment date here instead
    // would check a different month and could reject a payment that was approved,
    // or approve one booked into a closed period.
    const accountingMonth = args.recurringCompetence
      ? new Date(`${args.recurringCompetence}-01T00:00:00.000Z`)
      : new Date(args.date)
    // A banking external reference means the money already moved: the operation
    // was accepted while its month was open and the bank only confirmed it later
    // (a PIX or boleto can stay pending until a webhook arrives). Refusing the
    // record would lose an irreversible debit and leave the competence stuck in
    // PROCESSING, so the debit is always booked.
    //
    // It is not a silent bypass: booking into a month that is already closed
    // changes a result period whose DRE was materialized by CloseFinancialMonth,
    // so it is reported as a warning that the month's DRE has to be regenerated.
    // The pending policy decision is to refuse closing a month while it still has
    // recurring operations in flight, which keeps this path exceptional.
    const moneyAlreadyMoved = args.bankingExternalReference !== undefined
    if (moneyAlreadyMoved) {
      const closed = await this.isAccountingMonthClosed({
        churchId: args.churchId,
        month: accountingMonth.getUTCMonth() + 1,
        year: accountingMonth.getUTCFullYear(),
      })
      if (closed) {
        // The bank already debited, and the webhook answered 200 to church-banking
        // when it enqueued this job: nothing is going to be re-sent. Refusing the
        // record here would make the financial fact disappear, which is worse than
        // a late booking, so the debit is recorded and the period's materialized
        // DRE is dropped: the report recomputes it instead of staying wrong.
        this.logger.error(`Settlement into a closed accounting month`, {
          churchId: args.churchId,
          competence: args.recurringCompetence,
          bankingExternalReference: args.bankingExternalReference,
          month: accountingMonth.getUTCMonth() + 1,
          year: accountingMonth.getUTCFullYear(),
          dreInvalidated: true,
        })
        await this.dreRepository.invalidate({
          churchId: args.churchId,
          month: accountingMonth.getUTCMonth() + 1,
          year: accountingMonth.getUTCFullYear(),
        })
      }
      this.logger.info(`Booking a confirmed bank payment`, {
        churchId: args.churchId,
        competence: args.recurringCompetence,
        bankingExternalReference: args.bankingExternalReference,
        month: accountingMonth.getUTCMonth() + 1,
        year: accountingMonth.getUTCFullYear(),
      })
    } else {
      await new FinancialMonthValidator(this.financialYearRepository).validate({
        churchId: args.churchId,
        month: accountingMonth.getUTCMonth() + 1,
        year: accountingMonth.getUTCFullYear(),
      })
    }

    if (typeof args.availabilityAccount === "object") {
      const aggregateId = args.availabilityAccount.aggregateId

      const availabilityAccount = AvailabilityAccount.fromPrimitives(
        args.availabilityAccount
      )
      availabilityAccount.assignId(aggregateId)

      args.availabilityAccount = availabilityAccount
    }

    if (args.costCenter && typeof args.costCenter === "object") {
      args.costCenter = CostCenter.fromPrimitives(args.costCenter)
    }

    const voucher = args.voucher

    try {
      const financialRecord = FinanceRecord.create({
        financialRecordId: args.financialRecordId,
        financialConcept: args.financialConcept,
        churchId: args.churchId,
        amount: args.amount,
        date: new Date(args.date),
        availabilityAccount: args.availabilityAccount,
        description: args.description,
        voucher,
        costCenter: args.costCenter,
        type: args.financialRecordType,
        status: args.status,
        source: args.source,
        createdBy: args.createdBy,
        reference: args.reference,
        recurringPaymentId: args.recurringPaymentId,
        recurringCompetence: args.recurringCompetence,
        bankingExternalReference: args.bankingExternalReference,
      })
      await this.financialRecordRepository.upsert(financialRecord)

      if (args.recurringPaymentId && args.bankingExternalReference) {
        const recurring = await this.recurringPaymentsRepository?.one({
          recurringPaymentId: args.recurringPaymentId,
        })
        const currentPayment = recurring?.getCurrentPayment()
        if (
          recurring &&
          currentPayment?.externalReference === args.bankingExternalReference
        ) {
          recurring.closeCurrentPayment(args.bankingExternalReference)
          await this.recurringPaymentsRepository?.saveIfCurrentPaymentMatches(
            recurring,
            currentPayment
          )
        }
      }

      this.logger.info(`CreateFinancialRecord committed`, {
        jobName: CreateFinancialRecordJob.name,
        churchId: args.churchId,
        financialRecordId: financialRecord.getFinancialRecordId(),
      })

      this.dispatchUpdateAvailabilityAccountBalance(args)
      this.dispatchUpdateCostCenter(args)
    } catch (e: any) {
      this.logger.error(`Error in create financial record process ${e.message}`)

      if (voucher) await this.store.deleteFile(voucher)

      throw e
    }
  }

  private dispatchUpdateCostCenter(args: FinancialRecordCreateQueue) {
    if (!args.costCenter) {
      return
    }

    if (!this.isRealizedStatus(args.status)) {
      return
    }

    new DispatchUpdateCostCenterMaster(this.queueService).execute({
      churchId: args.churchId,
      amount: args.amount,
      costCenterId: args.costCenter!.getCostCenterId(),
      availabilityAccount: {
        availabilityAccountId:
          args.availabilityAccount.getAvailabilityAccountId(),
        accountName: args.availabilityAccount.getAccountName(),
        accountType: args.availabilityAccount.getType(),
        symbol: args.availabilityAccount.getSymbol(),
      },
    })
  }

  private dispatchUpdateAvailabilityAccountBalance(
    args: FinancialRecordCreateQueue
  ) {
    if (!args.availabilityAccount) {
      return
    }

    if (!this.isRealizedStatus(args.status)) {
      return
    }

    const financialConcept =
      typeof args.financialConcept === "object"
        ? FinancialConcept.fromPrimitives(args.financialConcept)
        : args.financialConcept

    new DispatchUpdateAvailabilityAccountBalance(this.queueService).execute({
      availabilityAccount: args.availabilityAccount,
      amount: args.amount,
      concept: financialConcept.getName(),
      operationType:
        financialConcept.getType() === ConceptType.INCOME
          ? TypeOperationMoney.MONEY_IN
          : TypeOperationMoney.MONEY_OUT,
      createdAt: args.date,
    })
  }

  private isRealizedStatus(status: FinancialRecordStatus): boolean {
    return (
      status === FinancialRecordStatus.CLEARED ||
      status === FinancialRecordStatus.RECONCILED
    )
  }

  /**
   * Whether the accounting month is already closed. It does not block the
   * booking: it only decides how loud the log is, because a debit that already
   * happened cannot be dropped.
   */
  private async isAccountingMonthClosed(input: {
    churchId: string
    month: number
    year: number
  }): Promise<boolean> {
    const financialMonth = await this.financialYearRepository.one(input)
    return financialMonth?.isClosed() === true
  }
}
