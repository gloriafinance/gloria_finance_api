import { Church, ChurchNotFound, type IChurchRepository } from "../../domain"
import { Logger } from "../../../Shared/adapter"

export class FindChurchById {
  private logger = Logger("FindChurchById")

  constructor(private readonly churchRepository: IChurchRepository) {}

  async execute(churchId: string): Promise<Church> {
    this.logger.info(`Search church by id: ${churchId}`)

    const church: Church | null = await this.churchRepository.one({
      churchId,
    })
    if (!church) {
      this.logger.debug(`Church not found`)
      throw new ChurchNotFound()
    }

    return church
  }
}
