import { DateBR } from "@/Shared/helpers"
import * as cron from "node-cron"
import { CloseFinancialMonthService } from "../services/CloseFinancialMonth.service"
import { GenerateFinancialMonthsService } from "@/Financial/infrastructure/services/GenerateFinancialMonths.service"

const isLastDayMonth = (): boolean => {
  const currencyDate = DateBR()

  const today = currencyDate.getDate()
  const currentMonth = currencyDate.getMonth() // Los meses comienzan desde 0 (enero = 0)
  const currentYear = currencyDate.getFullYear()

  const dateTomorrow = new Date(currentYear, currentMonth, today + 1)

  return dateTomorrow.getMonth() !== currentMonth
}

const isDecember = () => DateBR().getMonth() === 11

export const FinancialSchedules = () => {
  cron.schedule(
    "30 23 * * *",

    async () => {
      if (isLastDayMonth()) {
        await CloseFinancialMonthService()
      }

      if (isDecember) {
        GenerateFinancialMonthsService()
      }
    },
    {
      timezone: "America/Sao_Paulo",
    }
  )
}
