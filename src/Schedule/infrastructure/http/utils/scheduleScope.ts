import { HttpStatus } from "@/Shared/domain"
import type { AuthenticatedRequest } from "@/Shared/infrastructure/types/AuthenticatedRequest.type"
import type { ServerResponse } from "bun-platform-kit"

export const ensureChurchScope = (
  req: AuthenticatedRequest,
  res: ServerResponse
): string | undefined => {
  const scopedChurchId = req.auth?.churchId

  if (!scopedChurchId) {
    res.status(HttpStatus.FORBIDDEN).send({
      message: "Church scope is required for this operation.",
    })
    return undefined
  }

  return scopedChurchId
}
