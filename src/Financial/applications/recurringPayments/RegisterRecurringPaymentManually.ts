import type { IAvailabilityAccountRepository } from "@/FinanceConfig/domain/interfaces/AvailabilityAccountRepository.interface"
import { RecurringPaymentException } from "@/Financial/domain/exceptions/RecurringPayment.exception"
import type { IRecurringPaymentsRepository } from "@/Financial/domain/interfaces/RecurringPaymentsRepository.interface"
import type { RegisterRecurringPaymentRequest } from "@/Financial/domain/requests/RecurringPayment.request"
import type { IFinancialRecordRepository } from "@/Financial/domain/interfaces"
import type { IBankRepository } from "@/Banking/domain/interfaces/BankRepository.interface"
import { Provider } from "@/Banking/domain/enums/Provider.enum"
import type { IStorageService } from "@/Shared/domain/interfaces/StorageService.interface"
import { assertCompetence } from "./RecurringPaymentCompetence"
import { RegisterRecurringPaymentFinancialRecord } from "./RegisterRecurringPaymentFinancialRecord"

export type RegisterRecurringPaymentManuallyInput =
  RegisterRecurringPaymentRequest & {
    file?: any
  }

export type RegisterRecurringPaymentManuallyResult = {
  /**
   * `PROCESSING` because the financial record is created by a queued job, so at
   * response time it does not exist yet. Reporting `REGISTERED` here would claim
   * a durable fact the endpoint cannot guarantee.
   */
  status: "PROCESSING" | "ALREADY_REGISTERED"
  competence: string
}

/**
 * Manual execution: the church paid outside the bank, so Glória only records the
 * fact. No banking call is made and no `currentPayment` is created — the unique
 * index on (recurringPaymentId, recurringCompetence) is the duplicate guard.
 */
export class RegisterRecurringPaymentManually {
  constructor(
    private readonly recurringPaymentsRepository: IRecurringPaymentsRepository,
    private readonly financialRecordRepository: IFinancialRecordRepository,
    private readonly availabilityAccountRepository: IAvailabilityAccountRepository,
    private readonly bankRepository: IBankRepository,
    private readonly storage: IStorageService,
    private readonly recordRegistrar: RegisterRecurringPaymentFinancialRecord
  ) {}

  async execute(
    churchId: string,
    recurringPaymentId: string,
    createdBy: string,
    request: RegisterRecurringPaymentManuallyInput
  ): Promise<RegisterRecurringPaymentManuallyResult> {
    assertCompetence(request.competence)

    if (!request.file) {
      throw new RecurringPaymentException("RECURRING_PAYMENT_VOUCHER_REQUIRED")
    }

    // The two execution paths must not run for the same competence: a manual
    // record and a real provider debit would both claim it. While the church has
    // an active provider connection, a payment is either executed through the
    // bank or not paid at all.
    if (await this.hasProviderConnection(churchId)) {
      throw new RecurringPaymentException(
        "RECURRING_PAYMENT_MANUAL_NOT_ALLOWED"
      )
    }

    const recurring = await this.recurringPaymentsRepository.one({
      recurringPaymentId,
      churchId,
      // Same gate as the banking path: an inactive recurrence is not payable
      // through any route. A historical competence can still be settled by
      // reactivating the recurrence first, which keeps the rule explicit
      // instead of differing per execution path.
      status: "ACTIVE",
    })
    if (!recurring) {
      throw new RecurringPaymentException("RECURRING_PAYMENT_NOT_FOUND")
    }
    if (recurring.requiresCostCenterAssignment()) {
      throw new RecurringPaymentException(
        "RECURRING_PAYMENT_COST_CENTER_INVALID"
      )
    }

    const existing = await this.financialRecordRepository.findRecurringPayment(
      recurringPaymentId,
      request.competence
    )
    if (existing) {
      return {
        status: "ALREADY_REGISTERED",
        competence: request.competence,
      }
    }

    const account = await this.availabilityAccountRepository.one({
      availabilityAccountId: request.availabilityAccountId,
      churchId,
    })
    if (!account) {
      throw new RecurringPaymentException(
        "RECURRING_PAYMENT_AVAILABILITY_ACCOUNT_UNAVAILABLE"
      )
    }

    const amount = this.resolveAmount(recurring.getAmount(), request.amount)
    const voucher = await this.storage.uploadFile(request.file)

    try {
      await this.recordRegistrar.execute({
        recurring,
        competence: request.competence,
        amount,
        availabilityAccountId: request.availabilityAccountId,
        paymentDate: new Date(`${request.paymentDate}T00:00:00.000Z`),
        createdBy,
        voucher,
      })
    } catch (error) {
      // The voucher was already uploaded; do not leave it orphaned when the
      // record could not be scheduled.
      await this.storage.deleteFile(voucher).catch(() => undefined)
      throw error
    }

    return { status: "PROCESSING", competence: request.competence }
  }

  private async hasProviderConnection(churchId: string): Promise<boolean> {
    const banks = await this.bankRepository.all(churchId)
    return banks.some(
      (bank) => bank.isActive() && bank.isConnectedTo(Provider.ASAAS)
    )
  }

  /**
   * FIXED is settled by the configuration and must not be re-typed; VARIABLE
   * requires the amount actually paid for this competence.
   */
  private resolveAmount(
    configuredAmount: number | undefined,
    requestAmount: number | undefined
  ): number {
    if (configuredAmount !== undefined) {
      if (requestAmount !== undefined) {
        throw new RecurringPaymentException(
          "RECURRING_PAYMENT_AMOUNT_FORBIDDEN"
        )
      }
      return configuredAmount
    }
    if (
      requestAmount === undefined ||
      !Number.isFinite(requestAmount) ||
      requestAmount <= 0 ||
      Math.abs(requestAmount * 100 - Math.round(requestAmount * 100)) > 1e-7
    ) {
      throw new RecurringPaymentException("RECURRING_PAYMENT_AMOUNT_REQUIRED")
    }
    return requestAmount
  }
}
