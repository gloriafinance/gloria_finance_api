import { DateBR } from "../../helpers"
import * as cron from "node-cron"
import { closeFinancialMonth } from "./index"

const isLastDayMonth = (): boolean => {
  const currencyDate = DateBR()

  const today = currencyDate.getDate()
  const currentMonth = currencyDate.getMonth() // Los meses comienzan desde 0 (enero = 0)
  const currentYear = currencyDate.getFullYear()

  const dateTomorrow = new Date(currentYear, currentMonth, today + 1)

  return dateTomorrow.getMonth() !== currentMonth
}

export const Schedule = () => {
  cron.schedule(
    "30 23 * * *",

    async () => {
      if (isLastDayMonth()) {
        await closeFinancialMonth()
      }
    },
    {
      scheduled: true,
      timezone: "America/Sao_Paulo",
    }
  )
}
