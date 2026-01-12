import jwt = require("jsonwebtoken")
import { IAuthToken } from "../../domain"

export type AuthTokenPayload = {
  userId: string
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
  createToken(user: AuthTokenPayload): string {
    return jwt.sign(user, process.env.JWT_SECRET, {
      expiresIn: "1h",
    })
  }
}
