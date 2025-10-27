import {
  IAuthToken,
  InvalidPassword,
  IPasswordAdapter,
  IUserRepository,
  User,
  UserDisabled,
  UserNotFound,
} from "../domain"
import { Logger } from "../../Shared/adapter"

export class MakeLogin {
  private logger = Logger("MakeLogin")

  constructor(
    private readonly userRepository: IUserRepository,
    private readonly passwordAdapter: IPasswordAdapter,
    private readonly authToken: IAuthToken
  ) {}

  async execute(emailUser: string, passUser: string) {
    const user: User = await this.userRepository.findByEmail(emailUser)

    if (!user) {
      this.logger.error(`User with email ${emailUser} not found`)
      throw new UserNotFound(emailUser)
    }

    if (!user.isActive) {
      this.logger.error(`User with email ${emailUser} is disabled`)
      throw new UserDisabled(emailUser)
    }

    if (!(await this.passwordAdapter.check(passUser, user.getPassword()))) {
      this.logger.error(`Invalid password for user with email ${emailUser}`)
      throw new InvalidPassword()
    }

    user.updateLastLogin()

    await this.userRepository.upsert(user)

    return {
      user,
      token: this.authToken.createToken({
        churchId: user.getChurchId(),
        userId: user.getUserId(),
        email: user.getEmail(),
        name: user.getName(),
        profiles: user.getProfiles(),
      }),
    }
  }
}
