import * as dayjs from "dayjs"
import * as utc from "dayjs/plugin/utc"
import * as timezone from "dayjs/plugin/timezone"

dayjs.extend(utc)
dayjs.extend(timezone)

export const DateBR = (): Date => {
  return dayjs.tz(new Date(), "America/Sao_Paulo").toDate()
}

export const UTCStringToDateBR = (dateString: any): Date => {
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

  return dayjs.tz(dateString, "America/Sao_Paulo").toDate()
}
