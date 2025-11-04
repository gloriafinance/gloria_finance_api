import { FilterFinanceRecordRequest } from "../../domain"
import { Paginate } from "@abejarano/ts-mongodb-criteria"
import { IFinancialRecordRepository } from "../../domain/interfaces"
import { FinanceRecord } from "@/Financial/domain"
import { PrepareFinanceRecordCriteria } from "./ListFilters"

export class FetchingFinanceRecord {
  constructor(
    private readonly financialRecordRepository: IFinancialRecordRepository
  ) {}

  async execute(
    request: FilterFinanceRecordRequest
  ): Promise<Paginate<FinanceRecord>> {
    return await this.financialRecordRepository.list(
      PrepareFinanceRecordCriteria(request)
    )
  }
}
