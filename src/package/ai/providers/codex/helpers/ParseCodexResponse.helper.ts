const tryParseText = (value: string): unknown => {
  const trimmed = value.trim()
  if (!trimmed) {
    throw new Error("Codex returned empty response")
  }

  try {
    return JSON.parse(trimmed)
  } catch {
    throw new Error("Codex returned invalid JSON")
  }
}

const extractTextFromOutput = (
  payload: Record<string, unknown>
): string | undefined => {
  const output = payload.output
  if (!Array.isArray(output)) return undefined

  for (const item of output) {
    if (!item || typeof item !== "object") continue
    const content = (item as Record<string, unknown>).content
    if (!Array.isArray(content)) continue

    for (const part of content) {
      if (!part || typeof part !== "object") continue
      const textValue =
        (part as Record<string, unknown>).text ??
        (part as Record<string, unknown>).output_text
      if (typeof textValue === "string" && textValue.trim()) {
        return textValue
      }
    }
  }

  return undefined
}

export const parseCodexResponse = (
  payload: Record<string, unknown>
): unknown => {
  const directText =
    typeof payload.output_text === "string"
      ? payload.output_text
      : typeof payload.text === "string"
        ? payload.text
        : undefined

  const responseText = directText || extractTextFromOutput(payload)
  if (responseText) {
    return tryParseText(responseText)
  }

  if (payload.response && typeof payload.response === "object") {
    return parseCodexResponse(payload.response as Record<string, unknown>)
  }

  throw new Error("Codex returned non-JSON payload")
}
