export const buildCodexRepairPrompt = (
  normalizedSchema: Record<string, unknown>,
  invalidPayload: unknown,
  reason?: string
): string => {
  return [
    "Corrige el siguiente payload para que sea JSON valido y cumpla exactamente el schema.",
    "No agregues explicaciones ni markdown.",
    reason ? `Motivo del error: ${reason}` : undefined,
    `Schema: ${JSON.stringify(normalizedSchema)}`,
    `Payload original: ${typeof invalidPayload === "string" ? invalidPayload : JSON.stringify(invalidPayload)}`,
  ]
    .filter(Boolean)
    .join("\n\n")
}
