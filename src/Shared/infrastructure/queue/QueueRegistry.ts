import * as Queue from "bull"
import { IDefinitionQueue } from "../../domain"
import { Logger } from "../../adapter"

export class QueueRegistry {
  private static instance: QueueRegistry
  private logger = Logger("QueueRegistry")
  private queueInstances: Map<string, Queue.Queue> = new Map()
  private queueDefinitions: Map<string, IDefinitionQueue> = new Map()

  private redisConfig = {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT),
  }

  private constructor() {}

  static getInstance(): QueueRegistry {
    if (!QueueRegistry.instance) {
      QueueRegistry.instance = new QueueRegistry()
    }
    return QueueRegistry.instance
  }

  registerQueueDefinitions(definitions: IDefinitionQueue[]): void {
    this.logger.info(`Registering ${definitions.length} queue definitions`)

    definitions.forEach((definition) => {
      const queueName = definition.useClass.name
      this.queueDefinitions.set(queueName, definition)
    })
  }

  async initializeQueues(): Promise<void> {
    this.logger.info("Initializing all registered queues")

    for (const [queueName, definition] of this.queueDefinitions.entries()) {
      if (this.queueInstances.has(queueName)) {
        this.logger.error(`Queue ${queueName} already initialized, skipping`)
        continue
      }

      try {
        const queue = new Queue(queueName, {
          redis: this.redisConfig,
          defaultJobOptions: {
            delay: definition.delay ? definition.delay * 1000 : 0,
          },
        })

        // Configurar manejo de eventos
        queue.on("ready", () =>
          this.logger.info(`Queue ${queueName} connected to Redis`)
        )
        queue.on("error", (error) =>
          this.logger.error(`Queue ${queueName} error:`, error)
        )

        // Verificación importante: asegurarse que la cola esté activa
        await queue.isReady()

        // Algunas colas pueden iniciar en estado pausado, asegurarse de que estén activas
        const isPaused = await queue.isPaused()
        if (isPaused) {
          await queue.resume()
        }

        this.queueInstances.set(queueName, queue)
        this.logger.info(`Queue ${queueName} initialized and active`)
      } catch (error) {
        this.logger.error(`Error initializing queue ${queueName}:`, error)
      }
    }
  }

  getQueue(queueName: string): Queue.Queue | undefined {
    return this.queueInstances.get(queueName)
  }

  getQueueDefinition(queueName: string): IDefinitionQueue | undefined {
    return this.queueDefinitions.get(queueName)
  }

  getAllQueues(): Queue.Queue[] {
    return Array.from(this.queueInstances.values())
  }

  async shutdown(): Promise<void> {
    this.logger.info("Shutting down all queues")

    const closePromises = Array.from(this.queueInstances.entries()).map(
      async ([queueName, queue]) => {
        try {
          this.logger.info(`Closing queue ${queueName}`)
          queue.removeAllListeners()
          await queue.close()
          this.logger.info(`Queue ${queueName} closed successfully`)
        } catch (error) {
          this.logger.error(`Error closing queue ${queueName}:`, error)
        }
      }
    )

    await Promise.all(closePromises)
    this.queueInstances.clear()
    this.logger.info("All queues shut down successfully")
  }
}
