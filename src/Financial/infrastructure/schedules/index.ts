import * as dayjs from "dayjs"
import { DateBR } from "@/Shared/helpers"
import * as cron from "node-cron"
import { CloseFinancialMonthService } from "../services/CloseFinancialMonth.service"
import { GenerateFinancialMonthsService } from "@/Financial/infrastructure/services/GenerateFinancialMonths.service"

const isLastDayMonth = (): boolean => {
  const now = dayjs.tz("America/Sao_Paulo")
  return now.add(1, "day").month() !== now.month()
}

const isDecember = () => DateBR().getMonth() === 11

export const FinancialSchedules = () => {
  cron.schedule(
    "30 23 * * *",

    async () => {
      if (isLastDayMonth()) {
        await CloseFinancialMonthService()
      }

      if (isDecember()) {
        GenerateFinancialMonthsService()
      }
    },

    {
      timezone: "America/Sao_Paulo",
    }
  )
}
