import { AsyncLocalStorage } from "async_hooks"

import pino from "pino"
import { Logging } from "@google-cloud/logging"

class CustomLogger {
  private logger: pino.Logger

  constructor(private name: string) {
    const pinoOptions = {
      level: "info", // Configura el nivel mínimo de log
      formatters: {
        level(label: string) {
          return { level: label.toUpperCase() } // Estándar Google Cloud: niveles en mayúsculas
        },
      },
    }

    if (process.env.NODE_ENV === "production") {
      const googleTransport = createGoogleCloudLoggingTransport()

      this.logger = pino(
        pinoOptions,
        pino.multistream([
          { stream: process.stdout }, // Logs en consola
          { stream: googleTransport }, // Transporte a Google Cloud Logging
        ])
      )
    } else {
      this.logger = pino(
        {
          ...pinoOptions,
          transport: {
            target: "pino-pretty",
            options: {
              colorizeObjects: true,
              customColors: "err:red,info:green",
              singleLine: true,
              translateTime: "yyyy-mm-dd HH:MM:ss",
              ignore: "pid,hostname",
              colorize: true,
            },
          },
        },
        process.stdout
      ) // Solo logs en consola
    }
  }

  info(message: string, context?: object): void {
    this.logger.info(this.createLogMessage(message, context))
  }

  error(message: string, context?: object): void {
    this.logger.error(this.createLogMessage(message, context))
  }

  debug(message: string, context?: object): void {
    this.logger.debug(this.createLogMessage(message, context))
  }

  getRequestId(): string | undefined {
    return RequestContext.requestId
  }

  private createLogMessage(message: string, context?: object): object {
    const requestId = RequestContext.requestId || "N/A" // Recuperar el requestId
    return {
      message: `[${this.name}] ${message}`,
      requestId,
      ...context,
    }
  }
}

function createGoogleCloudLoggingTransport() {
  const logging = new Logging()
  const log = logging.log("church-api") // Nombre del log en Google Cloud

  const levelsMap: { [key: number]: string } = {
    10: "DEBUG",
    20: "DEBUG",
    30: "INFO",
    40: "WARNING",
    50: "ERROR",
    60: "CRITICAL",
  }

  return {
    write: async (msg: string) => {
      try {
        const logEntry = JSON.parse(msg) // Pino usa JSON para sus logs

        const severity = levelsMap[logEntry.level] || "DEFAULT"

        const timestamp = logEntry.time
          ? new Date(logEntry.time).toISOString()
          : new Date().toISOString() // Si no hay timestamp, usa la hora actual

        const entry = log.entry({ severity, timestamp }, logEntry)
        await log.write(entry) // Escribir en Google Cloud Logging
      } catch (error) {
        console.error("Error escribiendo en Google Cloud Logging:", error)
      }
    },
  }
}

interface Context {
  requestId: string
}

class RequestContext {
  private static storage = new AsyncLocalStorage<Context>()

  // Obtiene el contexto actual
  static get currentContext(): Context | undefined {
    return this.storage.getStore()
  }

  // Obtiene el requestId actual del contexto
  static get requestId(): string | undefined {
    return this.currentContext?.requestId
  }

  // Inicializa el contexto
  static run(context: Context, callback: () => void) {
    this.storage.run(context, callback)
  }
}

export { RequestContext }

export const Logger = (name: string) => new CustomLogger(name)
