import { FilterFinanceRecordRequest } from "@/Financial/domain"
import {
  Criteria,
  Filters,
  Operator,
  Order,
  OrderTypes,
} from "@abejarano/ts-mongodb-criteria"

export const PrepareFinanceRecordCriteria = (
  request: FilterFinanceRecordRequest
) => {
  const filters = []

  if (request.conceptType) {
    filters.push(
      new Map([
        ["field", "type"],
        ["operator", Operator.EQUAL],
        ["value", request.conceptType],
      ])
    )
  }

  if (request.availabilityAccountId) {
    filters.push(
      new Map([
        ["field", "availabilityAccount.availabilityAccountId"],
        ["operator", Operator.EQUAL],
        ["value", request.availabilityAccountId],
      ])
    )
  }

  if (request.churchId) {
    filters.push(
      new Map([
        ["field", "churchId"],
        ["operator", Operator.EQUAL],
        ["value", request.churchId],
      ])
    )
  }

  if (request.financialConceptId) {
    filters.push(
      new Map([
        ["field", "financialConcept.financialConceptId"],
        ["operator", Operator.EQUAL],
        ["value", request.financialConceptId],
      ])
    )
  }

  if (request.startDate && request.endDate) {
    const startDate = new Date(request.startDate)
    const endDate = new Date(request.endDate)

    filters.push(
      new Map<string, any>([
        ["field", "date"],
        ["operator", Operator.BETWEEN],
        ["value", { startDate, endDate }],
      ])
    )
  } else {
    if (request.startDate) {
      filters.push(
        new Map<string, string | Date>([
          ["field", "date"],
          ["operator", Operator.GTE],
          ["value", new Date(request.startDate)],
        ])
      )
    }

    if (request.endDate) {
      filters.push(
        new Map<string, string | Date>([
          ["field", "date"],
          ["operator", Operator.LTE],
          ["value", new Date(request.endDate)],
        ])
      )
    }
  }

  return new Criteria(
    Filters.fromValues(filters),
    Order.fromValues("date", OrderTypes.DESC),
    Number(request.perPage),
    Number(request.page)
  )
}
