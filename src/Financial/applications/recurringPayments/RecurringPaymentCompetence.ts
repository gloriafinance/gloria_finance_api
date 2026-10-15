import { RecurringPaymentException } from "@/Financial/domain/exceptions/RecurringPayment.exception"

export function assertCompetence(value: string): void {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    throw new RecurringPaymentException("RECURRING_PAYMENT_INVALID")
  }
}

export function dueDateForCompetence(
  dayOfMonth: number,
  competence: string
): string {
  assertCompetence(competence)
  const [year, month] = competence.split("-").map(Number)
  const lastDay = new Date(Date.UTC(year!, month!, 0)).getUTCDate()
  return `${competence}-${String(Math.min(dayOfMonth, lastDay)).padStart(2, "0")}`
}

export function saoPauloDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now)
  const part = (type: string) =>
    parts.find((value) => value.type === type)?.value
  return `${part("year")}-${part("month")}-${part("day")}`
}
