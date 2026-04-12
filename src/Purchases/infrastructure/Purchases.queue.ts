import { type IListQueue, QueueName } from "@/package/queue/domain"
import { PurchaseEventWorker } from "./workers/PurchaseEvent.worker.ts"

export const PurchasesQueue = (): IListQueue[] => [
  {
    name: QueueName.PurchasesEvent,
    useClass: PurchaseEventWorker,
    delay: 4,
  },
]
