import type { Schema } from "@google/generative-ai"

export const normalizeStructuredSchema = (
  schema: Schema
): Record<string, unknown> => {
  const walk = (node: unknown): unknown => {
    if (!node || typeof node !== "object") {
      return node
    }

    const copy = { ...(node as Record<string, unknown>) }

    if (copy.type === "object") {
      copy.additionalProperties = false
    }

    if (Array.isArray(copy.required)) {
      copy.required = [...copy.required]
    }

    if (copy.properties && typeof copy.properties === "object") {
      const normalizedProps: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(
        copy.properties as Record<string, unknown>
      )) {
        normalizedProps[key] = walk(value)
      }
      copy.properties = normalizedProps
    }

    if (copy.items) {
      copy.items = walk(copy.items)
    }

    return copy
  }

  return walk(schema) as Record<string, unknown>
}
