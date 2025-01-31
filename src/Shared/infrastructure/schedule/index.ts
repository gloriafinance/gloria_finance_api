import { ChurchMongoRepository } from "../../../Church/infrastructure"
import { CloseFinancialMonth } from "../../../ConsolidatedFinancial/applications"
import { FinancialYearMongoRepository } from "../../../ConsolidatedFinancial/infrastructure"

export const closeFinancialMonth = async (): Promise<void> => {
  const churches = await ChurchMongoRepository.getInstance().all()

  for (const church of churches) {
    await new CloseFinancialMonth(
      FinancialYearMongoRepository.getInstance()
    ).execute({
      churchId: church.getChurchId(),
      closed: true,
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
    })
  }
}
