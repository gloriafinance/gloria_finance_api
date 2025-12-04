import { Response } from "express"
import { HttpStatus } from "@/Shared/domain"
import { AuthenticatedRequest } from "@/Shared/infrastructure/types/AuthenticatedRequest.type"

export const ensureChurchScope = (
  req: AuthenticatedRequest,
  res: Response,
  churchId?: string
): string | undefined => {
  const scopedChurchId = req.auth?.churchId

  if (!scopedChurchId) {
    res.status(HttpStatus.FORBIDDEN).send({
      message: "Church scope is required for this operation.",
    })
    return undefined
  }

  if (churchId && scopedChurchId !== churchId) {
    res.status(HttpStatus.FORBIDDEN).send({
      message: "The requested church does not match the authenticated scope.",
    })
    return undefined
  }

  return scopedChurchId
}
