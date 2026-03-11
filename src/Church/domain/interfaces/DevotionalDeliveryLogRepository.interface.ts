import type {
  DevotionalDeliveryLog,
  ListDevotionalHistoryRequest,
} from "@/Church/domain"
import type { IRepository } from "@abejarano/ts-mongodb-criteria"

export interface IDevotionalDeliveryLogRepository extends IRepository<DevotionalDeliveryLog> {
  search(
    request: ListDevotionalHistoryRequest
  ): Promise<DevotionalDeliveryLog[]>
}
