export const DateBR = () => {
  const currentDate = new Date()

  // Obtener el offset en minutos de São Paulo (-3 horas)
  const saoPauloOffset = -3 * 60

  // Ajustar la fecha sumando el offset (en milisegundos)
  const adjustedTime = currentDate.getTime() + saoPauloOffset * 60 * 1000

  // Crear un nuevo objeto Date ajustado
  return new Date(adjustedTime)
}

export const UTCStringToDateBR = (dateString: any): Date => {
  if (typeof dateString !== "string") {
    return dateString
  }

  const [datePart, timePart] = dateString.split("T")
  const [y, m, day] = datePart.split("-").map(Number)
  const [h, min, secAndMs] = timePart.split(":")
  const sec = Number(secAndMs === undefined ? 0 : secAndMs.split(".")[0])

  // crea fecha interpretando los componentes como hora local:
  const dAsLocal = new Date(y, m - 1, day, Number(h), Number(min), sec)

  return dAsLocal
}
