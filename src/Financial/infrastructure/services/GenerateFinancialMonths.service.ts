import { ChurchMongoRepository } from "@/Church/infrastructure"
import { DateBR } from "@/Shared/helpers"
import { GenerateFinancialMonths } from "@/ConsolidatedFinancial/applications"
import { FinancialYearMongoRepository } from "@/ConsolidatedFinancial/infrastructure"

/**
 * Generar los meses financieros para todas las iglesias.
 *
 */
export const GenerateFinancialMonthsService = async () => {
  const currencyDate = DateBR()

  const newYear = currencyDate.getFullYear() + 1

  const churches = await ChurchMongoRepository.getInstance().all()

  const generateFinancialMonthsClass = new GenerateFinancialMonths(
    FinancialYearMongoRepository.getInstance()
  )

  for (const church of churches) {
    await generateFinancialMonthsClass.execute({
      churchId: church.getChurchId(),
      year: newYear,
    })
  }
}
