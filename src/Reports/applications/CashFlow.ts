import type { CashFlowFilters, ICashFlowRepository } from "@/Reports/domain"
import { Logger } from "@/Shared/adapter"

export class CashFlow {
  private logger = Logger(CashFlow.name)
  constructor(private readonly repository: ICashFlowRepository) {}

  async execute(filter: CashFlowFilters) {
    this.logger.info(`Starting Cash flow Report`, filter)

    return this.repository.getCashFlowDirectReport(filter)
  }
}
