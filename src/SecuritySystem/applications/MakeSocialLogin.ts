import {
  InvalidSocialToken,
  type ISocialTokenAdapter,
  type IUserRepository,
  User,
  UserDisabled,
  UserNotFound,
} from "../domain"
import { Logger } from "@/Shared/adapter"

export class MakeSocialLogin {
  private logger = Logger("MakeSocialLogin")

  constructor(
    private readonly userRepository: IUserRepository,
    private readonly socialTokenAdapter: ISocialTokenAdapter
  ) {}

  async execute(idToken: string) {
    let payload
    try {
      payload = await this.socialTokenAdapter.verifyIdToken(idToken)
    } catch (error: any) {
      this.logger.error(`Social token verification failed`, error)
      throw new InvalidSocialToken()
    }

    const email = payload?.email?.trim()
    if (!email) {
      this.logger.error(`Social token missing email`)
      throw new InvalidSocialToken()
    }

    const user: User | undefined = await this.userRepository.findByEmail(email)

    if (!user) {
      this.logger.error(`User with email ${email} not found`)
      throw new UserNotFound(email)
    }

    if (!user.isActive) {
      this.logger.error(`User with email ${email} is disabled`)
      throw new UserDisabled(email)
    }

    user.updateLastLogin()

    await this.userRepository.upsert(user)

    return user
  }
}
