import { DREMaster } from "@/Reports/domain/DREMaster"
import type { IRepository } from "@abejarano/ts-mongodb-criteria"

export interface IDRERepository extends IRepository<DREMaster> {
  /**
   * Drops the materialized snapshot of a period. The report recomputes it on the
   * next read, which is what keeps a closed month correct after an unavoidable
   * late booking.
   */
  invalidate(input: {
    churchId: string
    month: number
    year: number
  }): Promise<void>
}
