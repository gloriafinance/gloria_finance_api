import { FilterContributionsRequest } from "../../domain"
import {
  Criteria,
  Filters,
  Operator,
  Order,
  OrderTypes,
} from "@abejarano/ts-mongodb-criteria"
import { IOnlineContributionsRepository } from "../../domain/interfaces"
import { StringToDate } from "@/Shared/helpers"

export class ListContributions {
  constructor(
    private readonly contributionRepository: IOnlineContributionsRepository
  ) {}

  async execute(filter: FilterContributionsRequest) {
    return this.contributionRepository.findByCriteria(
      this.prepareFilter(filter)
    )
  }

  private prepareFilter(reqFilters: FilterContributionsRequest) {
    const filters = []

    if (reqFilters.startDate) {
      filters.push(
        new Map<string, string | Date>([
          ["field", "paidAt"],
          ["operator", Operator.GTE],
          ["value", StringToDate(reqFilters.startDate)],
        ])
      )
    }

    if (reqFilters.endDate) {
      filters.push(
        new Map<string, string | Date>([
          ["field", "paidAt"],
          ["operator", Operator.LTE],
          ["value", StringToDate(reqFilters.endDate)],
        ])
      )
    }

    if (reqFilters.status) {
      filters.push(
        new Map([
          ["field", "status"],
          ["operator", Operator.EQUAL],
          ["value", reqFilters.status],
        ])
      )
    }

    if (reqFilters.memberId) {
      filters.push(
        new Map([
          ["field", "member.memberId"],
          ["operator", Operator.EQUAL],
          ["value", reqFilters.memberId],
        ])
      )
    }

    if (reqFilters.churchId) {
      filters.push(
        new Map([
          ["field", "churchId"],
          ["operator", Operator.EQUAL],
          ["value", reqFilters.churchId],
        ])
      )
    }

    if (reqFilters.financialConceptId) {
      filters.push(
        new Map([
          ["field", "financialConcept.financialConceptId"],
          ["operator", Operator.EQUAL],
          ["value", reqFilters.financialConceptId],
        ])
      )
    }

    return new Criteria(
      Filters.fromValues(filters),
      Order.fromValues("createdAt", OrderTypes.DESC),
      Number(reqFilters.perPage),
      Number(reqFilters.page)
    )
  }
}
