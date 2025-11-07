import { IBankRepository } from "@/Banking/domain"
import { Bank } from "@/Banking/domain/Bank"

export class SearchBankByChurchId {
  constructor(private readonly bankRepository: IBankRepository) {}

  async execute(churchId: string): Promise<Bank[]> {
    return this.bankRepository.list(churchId)
  }
}
