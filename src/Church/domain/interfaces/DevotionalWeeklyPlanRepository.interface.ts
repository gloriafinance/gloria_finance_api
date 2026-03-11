import type { DevotionalWeeklyPlan } from "@/Church/domain"

export interface IDevotionalWeeklyPlanRepository {
  upsert(plan: DevotionalWeeklyPlan): Promise<void>
  findByChurchAndWeek(
    churchId: string,
    weekStartDate: string
  ): Promise<DevotionalWeeklyPlan | undefined>
  listEnabledByWeek(weekStartDate: string): Promise<DevotionalWeeklyPlan[]>
}
