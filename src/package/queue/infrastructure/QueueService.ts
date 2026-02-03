import { QueueRegistry } from "./QueueRegistry.ts"
import { QueueProcessor } from "./QueueProcessor.ts"
import { QueueDispatcher } from "./QueueDispatcher.ts"
import type { IListQueue } from "../domain"
import { QueueName } from "../domain"

export class QueueService {
  private static instance: QueueService
  private registry: QueueRegistry
  private processor: QueueProcessor
  private dispatcher: QueueDispatcher
  private initialized = false

  private constructor() {
    this.registry = QueueRegistry.getInstance()
    this.processor = QueueProcessor.getInstance()
    this.dispatcher = QueueDispatcher.getInstance()
  }

  static getInstance(): QueueService {
    if (!QueueService.instance) {
      QueueService.instance = new QueueService()
    }
    return QueueService.instance
  }

  async initialize(queueDefinitions: IListQueue[]): Promise<void> {
    if (this.initialized) {
      console.log("Queue system already initialized")
      return
    }

    console.log("Initializing queue system")

    try {
      // Registrar definiciones
      this.registry.registerQueueDefinitions(queueDefinitions)

      // Inicializar colas
      await this.registry.initializeQueues()

      await this.processor.startProcessing()

      this.initialized = true
      console.log("Queue system initialized successfully")
    } catch (error) {
      console.error("Error initializing queue system:", error)
      throw error
    }
  }

  dispatch<T>(queueName: QueueName, data: T): void {
    this.dispatcher.dispatch(queueName, data)
  }

  async shutdown(): Promise<void> {
    console.log("Shutting down queue system")

    // Pausar procesamiento primero
    await this.processor.pauseProcessing()

    // Cerrar colas
    await this.registry.shutdown()

    this.initialized = false
    console.log("Queue system shut down successfully")
  }
}
