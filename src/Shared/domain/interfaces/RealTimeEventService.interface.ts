import { RealTimeEvent } from "@/Shared/domain"

export interface IRealTimeEventService {
  notifyClient(clientId: string, event: RealTimeEvent, data: any): void
}
