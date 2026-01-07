import { Bank } from "@/Banking/domain"

export interface IBankRepository {
  upsert(bank: Bank): Promise<void>

  all(churchId: string): Promise<Bank[]>

  findById(bankId: string): Promise<Bank | undefined>
}
