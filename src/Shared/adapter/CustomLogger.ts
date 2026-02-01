import pino from "pino"
import pinoPretty from "pino-pretty"
import { RequestContext } from "bun-platform-kit"

class CustomLogger {
  private logger: pino.Logger

  constructor(private name: string) {
    const pinoOptions = {
      level: "info", // Configura el nivel mínimo de log
      formatters: {
        level(label: string) {
          return { level: label.toUpperCase() }
        },
        bindings(bindings) {
          return {
            pid: bindings.pid,
            hostname: bindings.hostname,
          }
        },
      },
      base: {
        service: this.name,
        env: process.env.NODE_ENV || "development",
      },
    }

    if (process.env.NODE_ENV === "production") {
      // this.logger = pino(
      //   {
      //     ...pinoOptions,
      //     timestamp: pino.stdTimeFunctions.isoTime,
      //   },
      //   pino.destination("/var/log/gloria-finance/app.log")
      // )
      this.logger = pino(pinoOptions)
    } else {
      const prettyStream = pinoPretty({
        colorizeObjects: true,
        customColors: "err:red,info:green",
        singleLine: true,
        translateTime: "yyyy-mm-dd HH:MM:ss",
        ignore: "pid,hostname",
        colorize: true,
      })

      this.logger = pino(
        {
          ...pinoOptions,
        },
        prettyStream
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
      message: ` ${message}`,
      ...context,
      ...{ name: `${this.name} ${requestId}` },
    }
  }
}

export const Logger = (name: string) => new CustomLogger(name)
