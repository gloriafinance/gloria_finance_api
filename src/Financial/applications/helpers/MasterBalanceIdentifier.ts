export default (
  entityId: string,
  period?: { year?: number; month?: number }
) => {
  let month = new Date().getMonth() + 1
  let year = new Date().getFullYear()

  if (period) {
    month = period.month!
    year = period.year!
  }

  return `${month}-${year}-${entityId}`
}
