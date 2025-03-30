import { QueueRegistry } from "./QueueRegistry"
import { Logger } from "../../adapter"
import { RequestContext } from "../../adapter/CustomLogger"
import { QueueName } from "../../domain"
import { QueueDispatcher } from "@/Shared/infrastructure/queue/QueueDispatcher"

export class QueueProcessor {
  private static instance: QueueProcessor
  private logger = Logger("QueueProcessor")
  private initialized: Set<string> = new Set()
  private registry: QueueRegistry

  private constructor() {
    this.registry = QueueRegistry.getInstance()
  }

  static getInstance(): QueueProcessor {
    if (!QueueProcessor.instance) {
      QueueProcessor.instance = new QueueProcessor()
    }
    return QueueProcessor.instance
  }

  /**
   * Inicia el procesamiento de todas las colas
   */
  async startProcessing(): Promise<void> {
    this.logger.info("Starting processing for all queues")

    for (const queue of this.registry.getAllQueues()) {
      this.initializeQueueProcessor(queue.name)

      // Verificar que la cola no esté pausada
      const isPaused = await queue.isPaused()
      if (isPaused) {
        this.logger.info(`Queue ${queue.name} is paused, resuming...`)
        await queue.resume()
      }
    }
  }

  /**
   * Pausa el procesamiento de todas las colas
   */
  async pauseProcessing(): Promise<void> {
    this.logger.info("Pausing processing for all queues")

    const pausePromises = this.registry.getAllQueues().map(async (queue) => {
      try {
        await queue.pause()
        this.logger.info(`Queue ${queue.name} paused`)
      } catch (error) {
        this.logger.error(`Error pausing queue ${queue.name}:`, error)
      }
    })

    await Promise.all(pausePromises)
    this.logger.info("All queues paused")
  }

  /**
   * Inicializa el procesador para una cola específica
   */
  private initializeQueueProcessor(queueName: string): void {
    // Evitar inicializar el mismo procesador varias veces
    if (this.initialized.has(queueName)) {
      this.logger.info(`Processor for ${queueName} already initialized`)
      return
    }

    const queue = this.registry.getQueue(queueName)
    const definition = this.registry.getQueueDefinition(queueName)

    if (!queue || !definition) {
      this.logger.error(
        `Cannot initialize processor for ${queueName}: queue or definition not found`
      )
      return
    }

    // Crear la instancia del worker
    const workerInstance = definition.inject
      ? new definition.useClass(...definition.inject)
      : new definition.useClass()

    // Configurar el procesamiento de trabajos
    queue.process(async (job, done) => {
      const requestId = job.data?.requestId || `job-${job.id}`

      RequestContext.run({ requestId }, async () => {
        try {
          await workerInstance.handle(job.data)
          done()
        } catch (error) {
          this.logger.error(
            `Error processing job ${job.id} in queue ${queueName}:`,
            error
          )
          done(error)
        }
      })
    })

    // Configurar listeners para eventos de la cola
    this.configureQueueListeners(queue)

    this.initialized.add(queueName)
    this.logger.info(`Processor for ${queueName} initialized successfully`)
  }

  /**
   * Configura los listeners para eventos de la cola
   */
  private configureQueueListeners(queue: any): void {
    // Remover listeners existentes para evitar duplicados
    queue.removeAllListeners("failed")
    queue.removeAllListeners("completed")

    // Configurar nuevo listener para trabajos fallidos
    queue.on("failed", (job, error) => {
      const requestId = job.data?.requestId || `job-${job.id}`

      RequestContext.run({ requestId }, async () => {
        this.logger.error(`Job ${job.id} in queue ${queue.name} failed:`, error)

        // Evitar ciclos recursivos en notificaciones de error
        if (queue.name !== QueueName.TelegramNotification) {
          const queueDispatcher = QueueDispatcher.getInstance()
          queueDispatcher.dispatch(QueueName.TelegramNotification, {
            message: `Job failed: ${queue.name} - ${error.message} (RequestId: ${requestId})`,
          })
        }
      })
    })
  }
}
