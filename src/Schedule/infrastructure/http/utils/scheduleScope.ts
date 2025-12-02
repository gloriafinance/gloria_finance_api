import { Response } from "express"
import { HttpStatus } from "@/Shared/domain"
import { AuthenticatedRequest } from "@/Shared/infrastructure/types/AuthenticatedRequest.type"

export const ensureChurchScope = (
  req: AuthenticatedRequest,
  res: Response,
  churchId: string
): boolean => {
  if (req.auth?.churchId && req.auth.churchId !== churchId) {
    res.status(HttpStatus.FORBIDDEN).send({
      message: "The requested church does not match the authenticated scope.",
    })
    return false
  }
  return true
}
