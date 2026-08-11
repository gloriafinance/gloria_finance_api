import {
  FinancialMonth,
  type IFinancialYearRepository,
  type ListFinancialMonthRequest,
} from "@/ConsolidatedFinancial/domain"
import { Logger } from "@/Shared/adapter"
import { Order } from "@abejarano/ts-mongodb-criteria"

export class ListFinancialMonth {
  private logger = Logger(ListFinancialMonth.name)

  constructor(
    private readonly financialYearRepository: IFinancialYearRepository
  ) {}

  async execute(req: ListFinancialMonthRequest): Promise<FinancialMonth[]> {
    this.logger.info(`Listing financial months`, req)

    return await this.financialYearRepository.many(
      {
        ...req,
      },
      { sort: Order.asc("month") }
    )
  }
}
