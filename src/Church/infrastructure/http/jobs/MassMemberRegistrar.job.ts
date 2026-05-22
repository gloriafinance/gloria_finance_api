import type { IJob } from "@/package/queue/domain"
import { Logger } from "@/Shared/adapter"

export class MassMemberRegistrarJob implements IJob {
  private readonly logger = Logger(MassMemberRegistrarJob.name)

  handle(file: string): Promise<any | void> {
    throw new Error("Method not implemented.")
  }
}
