import { Logging } from "@google-cloud/logging"
import { RequestContext } from "bun-platform-kit"
import type pino from "pino"

type ParsedLogEntry = {
  level?: number | string
  time?: number | string
  [key: string]: unknown
}

const LEVEL_TO_SEVERITY: Record<string, string> = {
  "10": "DEBUG",
  "20": "DEBUG",
  "30": "INFO",
  "40": "WARNING",
  "50": "ERROR",
  "60": "CRITICAL",
  trace: "DEBUG",
  debug: "DEBUG",
  info: "INFO",
  warn: "WARNING",
  warning: "WARNING",
  error: "ERROR",
  fatal: "CRITICAL",
}

export class GoogleCloudLoggerTransportService {
  private static instance: pino.DestinationStream

  static getInstance(): pino.DestinationStream {
    if (!GoogleCloudLoggerTransportService.instance) {
      GoogleCloudLoggerTransportService.instance = this.createTransport()
    }

    return GoogleCloudLoggerTransportService.instance
  }

  private static createTransport(): pino.DestinationStream {
    const logName = process.env.GCP_LOG_NAME || "gloria_finance_api"
    const projectId = process.env.GCP_PROJECT_ID?.trim()
    const logging = projectId ? new Logging({ projectId }) : new Logging()
    const log = logging.log(logName)

    return {
      write(message: string): void {
        const requestId = RequestContext.requestId || "N/A"
        const parsedMessage =
          GoogleCloudLoggerTransportService.safeJsonParse(message)

        const severity = GoogleCloudLoggerTransportService.resolveSeverity(
          parsedMessage?.level
        )

        const timestamp = GoogleCloudLoggerTransportService.resolveTimestamp(
          parsedMessage?.time
        )

        const metadata = {
          severity,
          timestamp,
          labels: {
            requestId,
          },
        }

        const payload = parsedMessage
          ? { ...parsedMessage, requestId }
          : { message, requestId }

        const entry = log.entry(metadata, payload)
        void log.write(entry).catch((error) => {
          // Prevent recursive logger calls if transport fails.
          console.error("Failed to write log to Google Cloud Logging", error)
        })
      },
    }
  }

  private static safeJsonParse(message: string): ParsedLogEntry | undefined {
    try {
      return JSON.parse(message) as ParsedLogEntry
    } catch {
      return undefined
    }
  }

  private static resolveSeverity(level?: number | string): string {
    if (typeof level === "number") {
      return LEVEL_TO_SEVERITY[String(level)] || "DEFAULT"
    }

    if (typeof level === "string") {
      const resolved =
        LEVEL_TO_SEVERITY[level.toLowerCase()] || LEVEL_TO_SEVERITY[level]
      return resolved || "DEFAULT"
    }

    return "DEFAULT"
  }

  private static resolveTimestamp(time?: number | string): string {
    if (!time) {
      return new Date().toISOString()
    }

    const date = new Date(time)
    if (Number.isNaN(date.getTime())) {
      return new Date().toISOString()
    }

    return date.toISOString()
  }
}
