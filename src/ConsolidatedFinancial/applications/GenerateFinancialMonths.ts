import { FinancialMonth, IFinancialYearRepository } from "../domain"

export class GenerateFinancialMonths {
  constructor(
    private readonly financialYearRepository: IFinancialYearRepository
  ) {}

  async execute(args: { churchId: string; year: number }): Promise<void> {
    let month = new Date().getMonth() + 1

    for (month = 1; month <= 12; month++) {
      const financialMonth = FinancialMonth.create(
        args.churchId,
        month,
        args.year
      )
      await this.financialYearRepository.upsert(financialMonth)
    }
  }
}
