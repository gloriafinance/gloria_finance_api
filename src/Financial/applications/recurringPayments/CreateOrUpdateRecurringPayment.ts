import type { IFinancialConceptRepository } from "@/FinanceConfig/domain/interfaces/FinancialConceptRepository.interface"
import type { IFinancialConfigurationRepository } from "@/FinanceConfig/domain/interfaces/FinancialConfigurationRepository.interface"
import { ConceptType } from "@/FinanceConfig/domain/enums/ConcepType.enum"
import { RecurringPaymentException } from "@/Financial/domain/exceptions/RecurringPayment.exception"
import { RecurringPayments } from "@/Financial/domain/RecurringPayments"
import type { IRecurringPaymentsRepository } from "@/Financial/domain/interfaces/RecurringPaymentsRepository.interface"
import type { RecurringPaymentConfigurationRequest } from "@/Financial/domain/requests/RecurringPayment.request"

export class CreateOrUpdateRecurringPayment {
  constructor(
    private readonly recurringPaymentsRepository: IRecurringPaymentsRepository,
    private readonly financialConceptRepository: IFinancialConceptRepository,
    private readonly financialConfigurationRepository: IFinancialConfigurationRepository
  ) {}

  async create(
    churchId: string,
    request: RecurringPaymentConfigurationRequest
  ): Promise<RecurringPayments> {
    await this.assertImputation(churchId, request)
    const payment = RecurringPayments.create({
      ...request,
      churchId,
      status: request.status ?? "ACTIVE",
    })
    await this.recurringPaymentsRepository.upsert(payment)
    return payment
  }

  async update(
    churchId: string,
    id: string,
    request: RecurringPaymentConfigurationRequest
  ): Promise<RecurringPayments> {
    const existing = await this.recurringPaymentsRepository.one({
      recurringPaymentId: id,
      churchId,
    })
    if (!existing) {
      throw new RecurringPaymentException("RECURRING_PAYMENT_NOT_FOUND")
    }
    await this.assertImputation(churchId, request)

    const expected = existing.getCurrentPayment()
    existing.updateConfiguration({
      ...request,
      status: request.status ?? existing.getStatus(),
    })
    const saved =
      await this.recurringPaymentsRepository.saveIfCurrentPaymentMatches(
        existing,
        expected
      )
    if (!saved)
      throw new RecurringPaymentException("RECURRING_PAYMENT_IN_PROGRESS")
    return existing
  }

  /**
   * Every expense is imputed, so both the concept (OUTGO) and the cost center
   * must exist for this church before the permanent configuration is stored.
   */
  private async assertImputation(
    churchId: string,
    request: RecurringPaymentConfigurationRequest
  ): Promise<void> {
    const concept = await this.financialConceptRepository.one({
      financialConceptId: request.financialConceptId,
      churchId,
      active: true,
      type: ConceptType.OUTGO,
    })
    if (!concept) {
      throw new RecurringPaymentException(
        "RECURRING_PAYMENT_FINANCIAL_CONCEPT_INVALID"
      )
    }

    const costCenter =
      await this.financialConfigurationRepository.findCostCenterByCostCenterId(
        request.costCenterId,
        churchId
      )
    if (!costCenter) {
      throw new RecurringPaymentException(
        "RECURRING_PAYMENT_COST_CENTER_INVALID"
      )
    }
  }
}
