import { Member } from "@/Church/domain"
import { IQueue } from "@/Shared/domain"
import { IPasswordAdapter, IUserRepository, User } from "../domain"
import { CreateOrUpdateUser } from "./CreateOrUpdateUser"

import { Logger } from "@/Shared/adapter"

export class CreateUserForMemberJob implements IQueue {
  private logger = Logger(CreateUserForMemberJob.name)

  constructor(
    private readonly userRepository: IUserRepository,
    private readonly passwordAdapter: IPasswordAdapter
  ) {}

  async handle(args: any): Promise<void> {
    this.logger.info(
      `User creation request for member: ${JSON.stringify(args)}`
    )
    const member = Member.fromPrimitives(args)

    const userExist: User = await this.userRepository.findByEmail(
      member.getEmail()
    )

    if (userExist) {
      return
    }
    this.logger.info("Create user")

    await new CreateOrUpdateUser(
      this.userRepository,
      this.passwordAdapter
    ).execute({
      name: member.getName(),
      memberId: member.getMemberId(),
      email: member.getEmail(),
      password: member.getDni().replace(".", "").replace("-", ""),
      isActive: true,
      churchId: member.getChurch().churchId,
    })
  }
}
