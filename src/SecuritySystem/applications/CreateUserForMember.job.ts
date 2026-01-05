import { Member } from "@/Church/domain"
import { IJob, IQueueService, QueueName } from "@/Shared/domain"
import { IPasswordAdapter, IUserRepository, User } from "../domain"
import { CreateOrUpdateUser } from "./CreateOrUpdateUser"

import { Logger } from "@/Shared/adapter"
import { BootstrapPermissionsRequest } from "./rbac/Jobs/BootstrapPermissions.job"

export class CreateUserForMemberJob implements IJob {
  private logger = Logger(CreateUserForMemberJob.name)

  constructor(
    private readonly userRepository: IUserRepository,
    private readonly passwordAdapter: IPasswordAdapter,
    private readonly queueService: IQueueService
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

    const user = await new CreateOrUpdateUser(
      this.userRepository,
      this.passwordAdapter
    ).execute({
      name: member.getName(),
      memberId: member.getMemberId(),
      email: member.getEmail(),
      password: member.getDni().replace(".", "").replace("-", ""),
      isActive: true,
      churchId: member.getChurch().churchId,
      isSuperUser: false,
    })

    this.queueService.dispatch<BootstrapPermissionsRequest>(
      QueueName.BootstrapPermissionsJob,
      {
        churchId: member.getChurch().churchId,
        roles: ["MEMBER"],
        userId: user.getUserId(),
      }
    )
  }
}
