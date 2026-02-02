import { DREMaster } from "@/Reports/domain/DREMaster"

export interface IDRERepository {
  upsert(dre: DREMaster): Promise<void>
}
