export { encrypt } from "./hash"
export { checkPassword } from "./hash"
export * from "./date"
export { UnitOfWork, UnitOfWorkRollbackError } from "./unitOfWork"

export const readFirstString = (
  source: Record<string, unknown>,
  keys: string[]
): string | null => {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim()
    }
  }
  return null
}

export const compactText = (value: string): string =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
