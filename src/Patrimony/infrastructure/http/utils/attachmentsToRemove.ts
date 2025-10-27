const toTrimmedString = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined
  }

  const trimmed = value.trim()

  return trimmed.length > 0 ? trimmed : undefined
}

export const normalizeAttachmentsToRemove = (
  raw: unknown
): string[] | undefined => {
  if (Array.isArray(raw)) {
    const normalized = raw
      .map((value) => toTrimmedString(value))
      .filter((value): value is string => typeof value === "string")

    return normalized.length > 0 ? normalized : undefined
  }

  const trimmed = toTrimmedString(raw)

  if (!trimmed) {
    return undefined
  }

  if (
    (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
    trimmed.startsWith("{")
  ) {
    try {
      const parsed = JSON.parse(trimmed)

      if (Array.isArray(parsed)) {
        const normalized = parsed
          .map((value) => toTrimmedString(value))
          .filter((value): value is string => typeof value === "string")

        return normalized.length > 0 ? normalized : undefined
      }
    } catch (error) {
      // Fallback to treating the trimmed value as a single identifier
    }
  }

  return [trimmed]
}
