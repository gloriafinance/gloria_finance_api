import type {
  Devotional,
  DevotionalDayOfWeek,
  DevotionalStatus,
} from "@/Church/domain"

export interface IDevotionalRepository {
  upsert(devotional: Devotional): Promise<void>
  findByDevotionalId(
    churchId: string,
    devotionalId: string
  ): Promise<Devotional | undefined>
  findByChurchAndWeek(
    churchId: string,
    weekStartDate: string
  ): Promise<Devotional[]>
  deleteByChurchWeekAndDays(
    churchId: string,
    weekStartDate: string,
    days: DevotionalDayOfWeek[]
  ): Promise<void>
  claimGeneration(churchId: string, devotionalId: string): Promise<boolean>
  listDueForGeneration(churchId: string, now: Date): Promise<Devotional[]>
  listByStatus(
    churchId: string,
    status: DevotionalStatus
  ): Promise<Devotional[]>
}
