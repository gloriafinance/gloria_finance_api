import { ChurchMongoRepository } from "@/Church/infrastructure"
import { FinancialYearMongoRepository } from "@/ConsolidatedFinancial/infrastructure"
import { ActionsFinancialMonth } from "@/ConsolidatedFinancial/domain"
import { UpdateFinancialMonth } from "@/ConsolidatedFinancial/applications/FinancialMonth"

export const closeFinancialMonth = async (): Promise<void> => {
  const churches = await ChurchMongoRepository.getInstance().all()

  for (const church of churches) {
    await new UpdateFinancialMonth(
      FinancialYearMongoRepository.getInstance()
    ).execute({
      action: ActionsFinancialMonth.CLOSE,
      churchId: church.getChurchId(),
      month: new Date().getMonth(),
      year: new Date().getFullYear(),
    })
  }
}
