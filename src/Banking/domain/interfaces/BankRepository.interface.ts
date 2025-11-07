import { Bank } from "@/Banking/domain"

export interface IBankRepository {
  upsert(bank: Bank): Promise<void>

  list(churchId: string): Promise<Bank[]>

  one(bankId: string): Promise<Bank | undefined>
}
