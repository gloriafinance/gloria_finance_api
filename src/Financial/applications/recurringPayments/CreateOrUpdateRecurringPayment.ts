import type { IFinancialConceptRepository } from "@/FinanceConfig/domain"
import { ConceptType } from "@/FinanceConfig/domain/enums/ConcepType.enum"
import { RecurringPaymentException } from "@/Financial/domain/exceptions/RecurringPayment.exception"
import { RecurringPayments } from "@/Financial/domain/RecurringPayments"
import type { IRecurringPaymentsRepository } from "@/Financial/domain/interfaces/RecurringPaymentsRepository.interface"
import type { RecurringPaymentConfigurationRequest } from "@/Financial/domain/requests/RecurringPayment.request"

export class CreateOrUpdateRecurringPayment {
  constructor(
    private readonly recurringPaymentsRepository: IRecurringPaymentsRepository,
    private readonly financialConceptRepository: IFinancialConceptRepository
  ) {}

  async create(
    churchId: string,
    request: RecurringPaymentConfigurationRequest
  ): Promise<RecurringPayments> {
    await this.validateConcept(churchId, request.financialConceptId)
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
      recurringPaymentsId: id,
      churchId,
    })
    if (!existing) {
      throw new RecurringPaymentException("RECURRING_PAYMENT_NOT_FOUND")
    }
    await this.validateConcept(churchId, request.financialConceptId)

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

  private async validateConcept(
    churchId: string,
    financialConceptId: string
  ): Promise<void> {
    const concept = await this.financialConceptRepository.one({
      financialConceptId,
      churchId,
      active: true,
      type: ConceptType.OUTGO,
    })
    if (!concept) {
      throw new RecurringPaymentException(
        "RECURRING_PAYMENT_FINANCIAL_CONCEPT_INVALID"
      )
    }
  }
}
