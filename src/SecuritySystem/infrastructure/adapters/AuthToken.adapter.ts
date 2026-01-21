import jwt, { type Secret, type SignOptions } from "jsonwebtoken"
import { IAuthToken } from "../../domain"

export type AuthTokenPayload = {
  userId: string
  memberId?: string
  churchId: string
  email: string
  name: string
  profiles?: any
  [key: string]: any
  isSuperUser: boolean
  lang: string
  symbolFormatMoney: string
}

export class AuthTokenAdapter implements IAuthToken {
  private accessTokenSecret(): string {
    const secret = process.env.JWT_SECRET
    if (!secret) {
      throw new Error("JWT_SECRET is not configured")
    }
    return secret
  }

  private refreshTokenSecret(): string {
    const secret = process.env.JWT_REFRESH_SECRET ?? process.env.JWT_SECRET
    if (!secret) {
      throw new Error("JWT_REFRESH_SECRET is not configured")
    }
    return secret
  }

  private accessTokenExpiresIn(): string {
    return process.env.JWT_ACCESS_EXPIRES_IN ?? "1h"
  }

  private refreshTokenExpiresIn(): string {
    return process.env.JWT_REFRESH_EXPIRES_IN ?? "30d"
  }

  createAccessToken(user: AuthTokenPayload): string {
    const options: SignOptions = {
      expiresIn: this.accessTokenExpiresIn() as SignOptions["expiresIn"],
    }
    return jwt.sign(user, this.accessTokenSecret() as Secret, options)
  }

  createRefreshToken(user: AuthTokenPayload): string {
    const options: SignOptions = {
      expiresIn: this.refreshTokenExpiresIn() as SignOptions["expiresIn"],
    }
    return jwt.sign(user, this.refreshTokenSecret() as Secret, options)
  }

  verifyRefreshToken(token: string): AuthTokenPayload {
    return jwt.verify(token, this.refreshTokenSecret()) as AuthTokenPayload
  }

  createToken(user: AuthTokenPayload): string {
    return this.createAccessToken(user)
  }
}
