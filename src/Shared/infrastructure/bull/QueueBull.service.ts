import { IDefinitionQueue, IQueueService, QueueName } from "../../domain"
import * as fs from "fs"
import * as Queue from "bull"
import * as path from "path"
import { Logger } from "../../adapter"
import { RequestContext } from "../../adapter/CustomLogger"

export class QueueBullService implements IQueueService {
  private static instance: QueueBullService
  private logger = Logger("QueueBullService")
  private instanceQueuesBull: Queue.Queue[] = []
  private queueMap: Record<string, IDefinitionQueue> = {}
  private redisOptions = {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT),
  }

  private constructor() {} // Singleton: evitar instanciación externa

  static getInstance() {
    if (!QueueBullService.instance) {
      QueueBullService.instance = new QueueBullService()
    }
    return QueueBullService.instance
  }

  getQueuesBull() {
    return this.instanceQueuesBull
  }

  listen() {
    for (const queueName in this.queueMap) {
      const definitionQueue = this.queueMap[queueName]
      const worker = this.instanceQueuesBull.find((q) => q.name === queueName)

      if (!worker) {
        this.logger.error(`Worker not found for queue: ${queueName}`)
        continue
      }

      const instanceWorker =
        definitionQueue.inject !== undefined
          ? new definitionQueue.useClass(...definitionQueue.inject)
          : new definitionQueue.useClass()

      worker.process(async (job, done) => {
        const requestId = job.data?.requestId || "N/A"

        RequestContext.run({ requestId }, async () => {
          try {
            await instanceWorker.handle(job.data)
            done() // Marca el trabajo como exitoso
          } catch (error) {
            done(error) // Marca el trabajo como fallido
          }
        })
      })

      this.addWorkerListeners(worker)
    }
  }

  dispatch(jobName: QueueName, args: any) {
    const requestId = RequestContext.requestId

    // Crear un contexto para la tarea asíncrona
    RequestContext.run({ requestId: requestId || "N/A" }, async () => {
      const queue = this.instanceQueuesBull.find((q) => q.name === jobName)

      if (!queue) {
        this.logger.error(`Queue not found: ${jobName}`)
        return
      }

      queue.add({ ...args, requestId }).catch((err) => {
        this.logger.error(`Failed to add job to queue: ${jobName}`, err)
      })
    })
  }

  addQueues(definitionQueues: IDefinitionQueue[]) {
    definitionQueues.forEach((queue) => {
      const instance = new Queue(queue.useClass.name, {
        redis: this.redisOptions,
        defaultJobOptions: { delay: queue.delay ? queue.delay * 1000 : 0 },
      })

      instance.on("ready", () =>
        this.logger.info(`Queue ${queue.useClass.name} is connected to Redis`)
      )
      instance.on("error", (error) =>
        console.error(`Error in queue ${queue.useClass.name}:`, error)
      )

      this.instanceQueuesBull.push(instance)
      this.queueMap[queue.useClass.name] = queue
    })

    this.generateEnumFile(
      "QueueName",
      path.resolve(`${__dirname}../../../domain/enums`, "QueueName.enum.ts")
    )
  }

  private addWorkerListeners(worker: Queue.Queue) {
    worker.on("failed", (job, e: Error) => {
      const requestId = job.data?.requestId || "N/A"

      RequestContext.run({ requestId }, async () => {
        this.logger.error(`Job failed: ${worker.name}`, e)

        QueueBullService.getInstance().dispatch(
          QueueName.TelegramNotification,
          {
            message: `Job failed: ${worker.name} ${e.message}  RequestId: ${requestId}`,
          }
        )
      })
    })
  }

  private generateEnumFile(enumName: string, outputPath: string) {
    const enumContent = Object.keys(this.queueMap)
      .map((key) => `  ${key} = "${key}",`)
      .join("\n")

    const fileContent = `export enum ${enumName} {\n${enumContent}\n}\n`

    if (fs.existsSync(outputPath)) {
      const existingContent = fs.readFileSync(outputPath, "utf8")
      if (existingContent === fileContent) return // El archivo ya está actualizado
    }

    fs.writeFileSync(outputPath, fileContent, "utf8")
    this.logger.info(`Enum file generated at ${outputPath}`)
  }

  // private addWorkerListeners(worker: Queue.Queue) {
  //   worker.on("failed", (job, err) =>
  //     this.logger.error(`Job failed in queue: ${worker.name}`, err)
  //   )
  // }
}
