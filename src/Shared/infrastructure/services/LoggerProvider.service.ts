import pino from "pino"
import { GenericException } from "@/Shared/domain"
import { GoogleCloudLoggerTransportService } from "@/package/gcp/infrastructure/GoogleCloudLoggerTransport.service"

export class LoggerProviderService {
  private static instance: pino.DestinationStream | undefined

  static getInstance(): pino.DestinationStream | undefined {
    if (this.instance) {
      return this.instance
    }

    const transport = (process.env.LOGGER_TRANSPORT || "stdout").toLowerCase()
    if (transport === "stdout" || transport === "console") {
      return undefined
    }

    if (transport === "axiom") {
      this.instance = this.createAxiomTransport()
      return this.instance
    }

    if (transport === "gcp") {
      this.instance = GoogleCloudLoggerTransportService.getInstance()
      return this.instance
    }

    throw new GenericException(`Unsupported LOGGER_TRANSPORT '${transport}'`)
  }

  private static createAxiomTransport(): pino.DestinationStream {
    const token = process.env.AXIOM_API_TOKEN
    if (!token) {
      throw new GenericException(
        "AXIOM_API_TOKEN is required when LOGGER_TRANSPORT=axiom"
      )
    }

    const dataset = process.env.AXIOM_DATASET || "gloria_finance_api"

    return pino.transport({
      target: "@axiomhq/pino",
      options: {
        dataset,
        token,
      },
    }) as pino.DestinationStream
  }
}
