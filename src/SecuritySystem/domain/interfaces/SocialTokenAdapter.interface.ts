export type SocialTokenPayload = {
  email: string
  name?: string
}

export interface ISocialTokenAdapter {
  verifyIdToken(idToken: string): Promise<SocialTokenPayload>
}
