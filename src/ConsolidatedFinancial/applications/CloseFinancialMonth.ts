import {
  IFinancialYearRepository,
  UpdateFinancialMonthRequest,
} from "../domain"
import { FinancialMontNotFound } from "../domain/exceptions"
import { Logger } from "../../Shared/adapter"

export class CloseFinancialMonth {
  private logger = Logger("CloseFinancialMonth")

  constructor(
    private readonly financialYearRepository: IFinancialYearRepository
  ) {}

  async execute(args: UpdateFinancialMonthRequest): Promise<void> {
    this.logger.info(`Closing financial month:`, args)

    const financialMonth = await this.financialYearRepository.one({
      month: args.month,
      year: args.year,
      churchId: args.churchId,
    })

    if (!financialMonth) {
      this.logger.info(`Financial month not found`)
      throw new FinancialMontNotFound()
    }

    financialMonth.close()

    await this.financialYearRepository.upsert(financialMonth)
  }
}
