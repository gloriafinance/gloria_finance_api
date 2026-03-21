import { decodeJwt } from "jose"

export const extractCodexAccountId = (
  accessToken?: string
): string | undefined => {
  if (!accessToken) return undefined

  try {
    const payload = decodeJwt(accessToken)
    const direct = payload["https://api.openai.com/auth.chatgpt_account_id"]
    if (typeof direct === "string" && direct.trim()) {
      return direct
    }

    const authObject = payload["https://api.openai.com/auth"]
    if (authObject && typeof authObject === "object") {
      const nested = (authObject as Record<string, unknown>).chatgpt_account_id
      if (typeof nested === "string" && nested.trim()) {
        return nested
      }
    }

    return undefined
  } catch {
    return undefined
  }
}
