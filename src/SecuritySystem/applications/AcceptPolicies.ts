import { IUserRepository, UserNotFound } from "../domain"
import { Logger } from "@/Shared/adapter"

export class AcceptPolicies {
  private logger = Logger("AcceptPolicies")

  constructor(private readonly userRepository: IUserRepository) {}

  async execute(
    userId: string,
    privacyPolicyVersion: string,
    sensitiveDataPolicyVersion: string
  ) {
    const user = await this.userRepository.findByUserId(userId)

    if (!user) {
      this.logger.error(`User with id ${userId} not found for policy accept`)
      throw new UserNotFound(userId)
    }

    user.acceptPolicies(privacyPolicyVersion, sensitiveDataPolicyVersion)

    await this.userRepository.upsert(user)

    return user
  }
}
