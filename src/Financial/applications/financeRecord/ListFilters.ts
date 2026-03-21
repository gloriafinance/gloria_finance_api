import { type FilterFinanceRecordRequest } from "@/Financial/domain"
import {
  Criteria,
  Filters,
  Operator,
  Order,
  OrderTypes,
} from "@abejarano/ts-mongodb-criteria"
import { buildUtcDateTime } from "@/Shared/helpers"

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

  if (request.referenceType) {
    filters.push(
      new Map([
        ["field", "reference.type"],
        ["operator", Operator.EQUAL],
        ["value", request.referenceType],
      ])
    )
  }

  if (request.referenceEntityId) {
    filters.push(
      new Map([
        ["field", "reference.entityId"],
        ["operator", Operator.EQUAL],
        ["value", request.referenceEntityId],
      ])
    )
  }

  if (request.startDate && request.endDate) {
    const startDate = buildUtcDateTime(request.startDate.toString(), "00:00:00")
    const endDate = buildUtcDateTime(request.endDate.toString(), "23:59:29")

    console.log(startDate)
    console.log(endDate)

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
          ["value", buildUtcDateTime(request.startDate.toString(), "00:00:00")],
        ])
      )
    }

    if (request.endDate) {
      filters.push(
        new Map<string, string | Date>([
          ["field", "date"],
          ["operator", Operator.LTE],
          ["value", buildUtcDateTime(request.endDate.toString(), "23:59:29")],
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
