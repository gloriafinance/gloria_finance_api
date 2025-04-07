import { IMemberRepository } from "@/Church/domain"
import { Logger } from "@/Shared/adapter"

export class AllMember {
  private logger = Logger(AllMember.name)

  constructor(private readonly memberRepository: IMemberRepository) {}

  async execute(churchId: string): Promise<any> {
    this.logger.info(`search all members`)

    return await this.memberRepository.all(churchId)
  }
}
