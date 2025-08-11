import { Response } from "express"
import { UpdateFinancialMonthRequest } from "@/ConsolidatedFinancial/domain"
import domainResponse from "@/Shared/helpers/domainResponse"
import { UpdateFinancialMonth } from "@/ConsolidatedFinancial/applications/FinancialMonth"
import { FinancialYearMongoRepository } from "@/ConsolidatedFinancial/infrastructure"
import { HttpStatus } from "@/Shared/domain"

export const UpdateFinancialMonthController = async (
  req: UpdateFinancialMonthRequest,
  res: Response
) => {
  try {
    await new UpdateFinancialMonth(
      FinancialYearMongoRepository.getInstance()
    ).execute(req)

    res
      .status(HttpStatus.OK)
      .send({ message: "Financial month updated successfully" })
  } catch (e) {
    domainResponse(e, res)
  }
}
