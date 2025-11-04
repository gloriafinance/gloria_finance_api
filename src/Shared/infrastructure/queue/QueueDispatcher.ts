import { IQueueService, QueueName } from "../../domain"
import { QueueRegistry } from "./QueueRegistry"
import { Logger } from "../../adapter"
import { v4 as uuidv4 } from "uuid"
import { RequestContext } from "@abejarano/ts-express-server"

export class QueueDispatcher implements IQueueService {
  private static instance: QueueDispatcher
  private logger = Logger("QueueDispatcher")
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
  dispatch(queueName: QueueName, args: any): void {
    const currentRequestId = RequestContext.requestId
    const requestId = currentRequestId || uuidv4()

    this.logger.info(
      `Dispatching job to queue ${queueName} (RequestId: ${requestId})`
    )

    RequestContext.run({ requestId }, async () => {
      const queue = this.registry.getQueue(queueName)

      if (!queue) {
        this.logger.error(`Cannot dispatch job: queue ${queueName} not found`)
        return
      }

      try {
        // Incluir el ID de solicitud en los datos del trabajo
        const jobData = { ...args, requestId }
        await queue.add(jobData)
      } catch (error) {
        this.logger.error(`Error dispatching job to queue ${queueName}:`, error)
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
      const queueStats = await queue.getJobCounts()
      stats[queue.name] = queueStats
    }

    return stats
  }

  /**
   * Limpia las colas (elimina trabajos completados y fallidos)
   */
  async cleanQueues(): Promise<void> {
    this.logger.info("Cleaning all queues")

    const cleanPromises = this.registry.getAllQueues().map(async (queue) => {
      try {
        await queue.clean(86400000, "completed") // Limpiar trabajos completados más antiguos que 1 día
        await queue.clean(604800000, "failed") // Limpiar trabajos fallidos más antiguos que 1 semana
        this.logger.info(`Queue ${queue.name} cleaned`)
      } catch (error) {
        this.logger.error(`Error cleaning queue ${queue.name}:`, error)
      }
    })

    await Promise.all(cleanPromises)
    this.logger.info("All queues cleaned")
  }
}
