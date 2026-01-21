export interface IAuthToken {
  createAccessToken(user: any): string
  createRefreshToken(user: any): string
  verifyRefreshToken(token: string): any
  createToken(user: any): string
}
