import dayjs from "dayjs"
import utc from "dayjs/plugin/utc"
import timezone from "dayjs/plugin/timezone"

dayjs.extend(utc)
dayjs.extend(timezone)

export const DateBR = (): Date => {
  return dayjs.tz(new Date(), "America/Sao_Paulo").toDate()
}

export const StringToDate = (dateString: any): Date => {
  if (typeof dateString !== "string") {
    return dateString
  }

  // const [datePart, timePart] = dateString.split("T")
  // const [y, m, day] = datePart.split("-").map(Number)
  // const [h, min, secAndMs] = timePart.split(":")
  // const sec = Number(secAndMs === undefined ? 0 : secAndMs.split(".")[0])
  //
  // // crea fecha interpretando los componentes como hora local:
  // const dAsLocal = new Date(y, m - 1, day, Number(h), Number(min), sec)
  //
  // return dAsLocal

  return dayjs.tz(dateString, "America/Sao_Paulo").local().toDate()
}

export const buildUtcDateTime = (date: string, time: string): Date => {
  const dateParts = date.split("-").map(Number)
  const timeParts = time.split(":").map(Number)

  if (
    dateParts.length !== 3 ||
    timeParts.length !== 3 ||
    dateParts.some(Number.isNaN) ||
    timeParts.some(Number.isNaN)
  ) {
    throw new Error(`Invalid UTC date time: ${date} ${time}`)
  }

  const [year, month, day] = dateParts as [number, number, number]
  const [hours, minutes, seconds] = timeParts as [number, number, number]

  return new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds))
}
