// src/Shared/infrastructure/queue/QueueService.ts

import { QueueRegistry } from "./QueueRegistry"
import { QueueProcessor } from "./QueueProcessor"
import { QueueDispatcher } from "./QueueDispatcher"
import { IDefinitionQueue, QueueName } from "../../domain"
import { Logger } from "../../adapter"

export class QueueService {
  private static instance: QueueService
  private logger = Logger("QueueService")
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

  async initialize(queueDefinitions: IDefinitionQueue[]): Promise<void> {
    if (this.initialized) {
      this.logger.debug("Queue system already initialized")
      return
    }

    this.logger.info("Initializing queue system")

    try {
      // Registrar definiciones
      this.registry.registerQueueDefinitions(queueDefinitions)

      // Inicializar colas
      await this.registry.initializeQueues()

      // Iniciar procesamiento
      await this.processor.startProcessing()

      this.initialized = true
      this.logger.info("Queue system initialized successfully")
    } catch (error) {
      this.logger.error("Error initializing queue system:", error)
      throw error
    }
  }

  dispatch(queueName: QueueName, data: any): void {
    this.dispatcher.dispatch(queueName, data)
  }

  async shutdown(): Promise<void> {
    this.logger.info("Shutting down queue system")

    // Pausar procesamiento primero
    await this.processor.pauseProcessing()

    // Cerrar colas
    await this.registry.shutdown()

    this.initialized = false
    this.logger.info("Queue system shut down successfully")
  }
}
