import type {
  CashFlowBucketDetailsFilters,
  CashFlowBucketDetailsResult,
  ICashFlowRepository,
} from "@/Reports/domain"
import { Logger } from "@/Shared/adapter"

export class CashFlowBucketDetails {
  private logger = Logger(CashFlowBucketDetails.name)

  constructor(private readonly repository: ICashFlowRepository) {}

  async execute(
    filters: CashFlowBucketDetailsFilters
  ): Promise<CashFlowBucketDetailsResult> {
    this.logger.info("Starting Cash flow bucket details", filters)

    return {
      startDate: filters.startDate,
      endDate: filters.endDate,
      groupBy: filters.groupBy,
      details: await this.repository.getCashFlowBucketDetails(filters),
    }
  }
}
