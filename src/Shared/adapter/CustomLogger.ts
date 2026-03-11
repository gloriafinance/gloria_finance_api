import pino from "pino"
import { RequestContext } from "bun-platform-kit"
import { LoggerProviderService } from "@/Shared/infrastructure/services/LoggerProvider.service"

class CustomLogger {
  private logger: pino.Logger

  constructor(private name: string) {
    const pinoOptions = {
      level: "debug", // Configura el nivel mínimo de log
      formatters: {
        level(label: string) {
          return { level: label.toUpperCase() }
        },
        bindings(bindings: any) {
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
      const transport = LoggerProviderService.getInstance()
      if (transport) {
        this.logger = pino(
          pinoOptions,
          pino.multistream([{ stream: transport }, { stream: process.stdout }])
        )
        return
      }
    }

    this.logger = pino(pinoOptions)
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
      ...{ name: `${this.name}`, requestId },
    }
  }
}

export const Logger = (name: string) => new CustomLogger(name)
