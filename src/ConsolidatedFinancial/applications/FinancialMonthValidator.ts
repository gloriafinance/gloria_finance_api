import { IFinancialYearRepository } from "../domain"
import { FinancialMonthIsClosed } from "../domain/exceptions"

import { Logger } from "@/Shared/adapter"
import { GenericException } from "@/Shared/domain"

export class FinancialMonthValidator {
  private logger = Logger("FinancialMonthValidator")

  constructor(
    private readonly financialYearRepository: IFinancialYearRepository
  ) {}

  async validate(params: { churchId: string; month?: number; year?: number }) {
    const { churchId, year, month } = params

    const currentYear = year ? year : new Date().getFullYear()
    const currentMonth = month ? month : new Date().getMonth() + 1

    this.logger.info(
      `Validating financial month ${currentMonth} ${currentYear} ${churchId}`
    )

    const financialMonth = await this.financialYearRepository.one({
      month: currentMonth,
      year: currentYear,
      churchId,
    })

    if (!financialMonth) {
      this.logger.info(`Financial month not found`, financialMonth)
      throw new GenericException("Financial month not found")
    }

    if (financialMonth.isClosed()) {
      this.logger.info(`Financial month is closed`, financialMonth)
      throw new FinancialMonthIsClosed()
    }
  }
}
