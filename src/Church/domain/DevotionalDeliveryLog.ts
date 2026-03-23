import { AggregateRoot } from "@abejarano/ts-mongodb-criteria"
import { IdentifyEntity } from "@/Shared/adapter"
import { DateBR } from "@/Shared/helpers"
import type { DevotionalDeliveryLogPrimitives } from "@/Church/domain"

export class DevotionalDeliveryLog extends AggregateRoot {
  private id?: string
  private devotionalDeliveryLogId: string
  private payload: DevotionalDeliveryLogPrimitives

  static create(
    payload: Omit<DevotionalDeliveryLogPrimitives, "devotionalDeliveryLogId">
  ) {
    const log = new DevotionalDeliveryLog()
    log.devotionalDeliveryLogId = IdentifyEntity.get("devotional_delivery")
    log.payload = {
      ...payload,
      devotionalDeliveryLogId: log.devotionalDeliveryLogId,
      attemptedAt: payload.attemptedAt ?? DateBR(),
    }
    return log
  }

  static override fromPrimitives(raw: any): DevotionalDeliveryLog {
    const log = new DevotionalDeliveryLog()
    log.id = raw.id
    log.devotionalDeliveryLogId = raw.devotionalDeliveryLogId
    log.payload = {
      devotionalDeliveryLogId: raw.devotionalDeliveryLogId,
      devotionalId: raw.devotionalId,
      churchId: raw.churchId,
      devotionalWeeklyPlanId: raw.devotionalWeeklyPlanId,
      weekStartDate: raw.weekStartDate,
      scheduleDate: raw.scheduleDate,
      scheduledAt: new Date(raw.scheduledAt),
      attemptedAt: new Date(raw.attemptedAt),
      audience: raw.audience,
      themeWeek: raw.themeWeek,
      versionNumber: Number(raw.versionNumber ?? 0),
      channels: raw.channels,
      results: raw.results,
      errors: Array.isArray(raw.errors) ? raw.errors : [],
      contentSnapshot: raw.contentSnapshot,
    }
    return log
  }

  getId(): string | undefined {
    return this.id
  }

  getPayload(): DevotionalDeliveryLogPrimitives {
    return {
      ...this.payload,
      channels: { ...this.payload.channels },
      results: { ...this.payload.results },
      errors: [...this.payload.errors],
      contentSnapshot: { ...this.payload.contentSnapshot },
    }
  }

  toPrimitives(): DevotionalDeliveryLogPrimitives {
    return this.getPayload()
  }
}
