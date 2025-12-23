import type { AuthTokenPayload } from "@/SecuritySystem/infrastructure/adapters/AuthToken.adapter"

declare global {
  namespace Express {
    interface AuthContext extends AuthTokenPayload {
      roles: string[]
      permissions: string[]
      isSuperuser?: boolean
      lang: string
    }

    interface Request {
      auth?: AuthContext
    }
  }
}

export {}
