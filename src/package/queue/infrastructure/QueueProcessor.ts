import { Worker } from "bullmq"
import { QueueRegistry } from "./QueueRegistry.ts"
import { RequestContext } from "bun-platform-kit"

export class QueueProcessor {
  private static instance: QueueProcessor
  private initialized: Set<string> = new Set()
  private registry: QueueRegistry
  private workers: Map<string, Worker> = new Map()

  private redisConfig = {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT || "6379"),
    username: process.env.REDIS_USER,
    password: process.env.REDIS_PASSWORD,
  }

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
    for (const queue of this.registry.getAllQueues()) {
      this.initializeQueueProcessor(queue.name)
    }
  }

  /**
   * Pausa el procesamiento de todas las colas
   */
  async pauseProcessing(): Promise<void> {
    console.log("Pausing processing for all queues")

    const pausePromises = Array.from(this.workers.entries()).map(
      async ([queueName, worker]) => {
        try {
          await worker.pause()
          console.log(`Worker for ${queueName} paused`)
        } catch (error) {
          console.error(`Error pausing worker for ${queueName}:`, error)
        }
      }
    )

    await Promise.all(pausePromises)
    console.log("All workers paused")
  }

  /**
   * Inicializa el procesador para una cola específica
   */
  private initializeQueueProcessor(queueName: string): void {
    // Evitar inicializar el mismo procesador varias veces
    if (this.initialized.has(queueName)) {
      console.log(`Processor for ${queueName} already initialized`)
      return
    }

    const definition = this.registry.getQueueDefinition(queueName)

    if (!definition) {
      console.error(
        `Cannot initialize processor for ${queueName}: definition not found`
      )
      return
    }

    if (!definition.useClass) {
      console.warn(
        `Cannot initialize processor for ${queueName}: useClass not defined`
      )
      return
    }

    // Crear la instancia del worker
    const workerInstance = definition.inject
      ? new definition.useClass(...definition.inject)
      : new definition.useClass()

    // BullMQ usa Worker en lugar de queue.process()
    const worker = new Worker(
      queueName,
      async (job) => {
        const requestId = job.data?.requestId || `job-${job.id}`

        return RequestContext.run({ requestId }, async () => {
          try {
            await workerInstance.handle(job.data)
          } catch (error: any) {
            console.error(
              `Error processing job ${job.id} in queue ${queueName}:`,
              error
            )
            throw error // BullMQ maneja el error automáticamente
          }
        })
      },
      {
        connection: this.redisConfig,
      }
    )

    // Configurar listeners para eventos del worker
    this.configureWorkerListeners(worker, queueName)

    this.workers.set(queueName, worker)
    this.initialized.add(queueName)
    console.log(`Processor for ${queueName} initialized successfully`)
  }

  /**
   * Configura los listeners para eventos del worker
   */
  private configureWorkerListeners(worker: Worker, queueName: string): void {
    // Configurar listener para trabajos fallidos
    worker.on("failed", (job: any, error: any) => {
      const requestId = job?.data?.requestId || `job-${job?.id}`

      RequestContext.run({ requestId }, async () => {
        console.error(`Job ${job?.id} in queue ${queueName} failed:`, error)

        // Evitar ciclos recursivos en notificaciones de error
        // if (queueName !== QueueName.TelegramNotificationJob) {
        //   const queueDispatcher = QueueDispatcher.getInstance();
        //   queueDispatcher.dispatch(QueueName.TelegramNotificationJob, {
        //     message: `Job failed: ${queueName} - ${error.message} (RequestId: ${requestId})`,
        //   });
        // }
      })
    })

    // Listener para trabajos completados (opcional)
    worker.on("completed", (job: any) => {
      console.log(`Job ${job?.id} in queue ${queueName} completed`)
    })
  }
}
