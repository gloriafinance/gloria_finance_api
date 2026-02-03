import type { IQueueService } from "../domain"
import { QueueName } from "../domain"
import { QueueRegistry } from "./QueueRegistry.ts"
import { RequestContext } from "bun-platform-kit"

export class QueueDispatcher implements IQueueService {
  private static instance: QueueDispatcher
  private registry: QueueRegistry

  private constructor() {
    this.registry = QueueRegistry.getInstance()
  }

  static getInstance(): QueueDispatcher {
    if (!QueueDispatcher.instance) {
      QueueDispatcher.instance = new QueueDispatcher()
    }
    return QueueDispatcher.instance
  }

  /**
   * Envía un trabajo a una cola específica
   */
  dispatch<T>(queueName: QueueName, args: T): void {
    const currentRequestId = RequestContext.requestId
    const requestId = currentRequestId || crypto.randomUUID()

    console.log(
      `Dispatching job to queue ${queueName} (RequestId: ${requestId})`
    )

    RequestContext.run({ requestId }, async () => {
      const queue = this.registry.getQueue(queueName)

      if (!queue) {
        console.error(`Cannot dispatch job: queue ${queueName} not found`)
        return
      }

      try {
        // Incluir el ID de solicitud en los datos del trabajo
        const jobData = { ...args, requestId }

        // BullMQ requiere un nombre de job como primer parámetro
        // Usamos el queueName como nombre del job por defecto
        await queue.add(queueName, jobData)
      } catch (error) {
        console.error(`Error dispatching job to queue ${queueName}:`, error)
      }
    })
  }

  /**
   * Obtiene estadísticas básicas de todas las colas
   */
  async getQueueStats(): Promise<Record<string, any>> {
    const stats: Record<string, any> = {}
    const queues = this.registry.getAllQueues()

    for (const queue of queues) {
      // BullMQ usa getJobCounts() que retorna un objeto con conteos
      const queueStats = await queue.getJobCounts()
      stats[queue.name] = queueStats
    }

    return stats
  }

  /**
   * Limpia las colas (elimina trabajos completados y fallidos)
   */
  async cleanQueues(): Promise<void> {
    console.log("Cleaning all queues")

    const cleanPromises = this.registry.getAllQueues().map(async (queue) => {
      try {
        // BullMQ clean() tiene syntax: clean(grace, limit, type)
        await queue.clean(86400000, 100, "completed") // Limpiar trabajos completados más antiguos que 1 día
        await queue.clean(604800000, 100, "failed") // Limpiar trabajos fallidos más antiguos que 1 semana
        console.log(`Queue ${queue.name} cleaned`)
      } catch (error) {
        console.error(`Error cleaning queue ${queue.name}:`, error)
      }
    })

    await Promise.all(cleanPromises)
    console.log("All queues cleaned")
  }
}
