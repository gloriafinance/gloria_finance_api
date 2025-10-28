import { FilterFinanceRecordRequest } from "../../domain"
import { Paginate } from "@abejarano/ts-mongodb-criteria"
import { IFinancialRecordRepository } from "../../domain/interfaces"
import { FinanceRecord } from "@/Financial/domain"
import { PrepareFinanceRecordCriteria } from "./ListFilters"

export class SearchFinanceRecord {
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

  // private prepareCriteria(request: FilterFinanceRecordRequest) {
  //   const filters = []
  //
  //   if (request.conceptType) {
  //     filters.push(
  //       new Map([
  //         ["field", "type"],
  //         ["operator", Operator.EQUAL],
  //         ["value", request.conceptType],
  //       ])
  //     )
  //   }
  //
  //   if (request.availabilityAccountId) {
  //     filters.push(
  //       new Map([
  //         ["field", "availabilityAccount.availabilityAccountId"],
  //         ["operator", Operator.EQUAL],
  //         ["value", request.availabilityAccountId],
  //       ])
  //     )
  //   }
  //
  //   if (request.churchId) {
  //     filters.push(
  //       new Map([
  //         ["field", "churchId"],
  //         ["operator", Operator.EQUAL],
  //         ["value", request.churchId],
  //       ])
  //     )
  //   }
  //
  //   if (request.financialConceptId) {
  //     filters.push(
  //       new Map([
  //         ["field", "financialConcept.financialConceptId"],
  //         ["operator", Operator.EQUAL],
  //         ["value", request.financialConceptId],
  //       ])
  //     )
  //   }
  //
  //   if (request.startDate && request.endDate) {
  //     const startDate = new Date(request.startDate)
  //     const endDate = new Date(request.endDate)
  //
  //     filters.push(
  //       new Map<string, any>([
  //         ["field", "date"],
  //         ["operator", Operator.BETWEEN],
  //         ["value", { startDate, endDate }],
  //       ])
  //     )
  //   } else {
  //     if (request.startDate) {
  //       filters.push(
  //         new Map<string, string | Date>([
  //           ["field", "date"],
  //           ["operator", Operator.GTE],
  //           ["value", new Date(request.startDate)],
  //         ])
  //       )
  //     }
  //
  //     if (request.endDate) {
  //       filters.push(
  //         new Map<string, string | Date>([
  //           ["field", "date"],
  //           ["operator", Operator.LTE],
  //           ["value", new Date(request.endDate)],
  //         ])
  //       )
  //     }
  //   }
  //
  //   return new Criteria(
  //     Filters.fromValues(filters),
  //     Order.fromValues("date", OrderTypes.DESC),
  //     Number(request.perPage),
  //     Number(request.page)
  //   )
  // }
}
