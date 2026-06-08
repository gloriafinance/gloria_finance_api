type CodexResponseRecord = Record<string, unknown>

export const normalizeCodexCompletedResponse = (
  response: CodexResponseRecord,
  streamedOutputItems: CodexResponseRecord[]
): CodexResponseRecord => {
  const output = Array.isArray(response.output) ? response.output : []

  if (output.length > 0 || streamedOutputItems.length === 0) {
    return response
  }

  return {
    ...response,
    output: streamedOutputItems,
  }
}
