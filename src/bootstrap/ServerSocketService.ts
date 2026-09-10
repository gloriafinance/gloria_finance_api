import { Server as BunEngine } from "@socket.io/bun-engine"
import { type BunWebSocketAdapterOptions } from "bun-platform-kit"
import { Server as SocketIOServer, Socket } from "socket.io"
import { Logger } from "@/Shared/adapter"
import { type IRealTimeEventService, RealTimeEvent } from "@/Shared/domain"

export class SocketIOService implements IRealTimeEventService {
  private static instance: SocketIOService
  private readonly io: SocketIOServer
  private readonly engine: BunEngine
  private readonly logger = Logger(SocketIOService.name)

  private constructor() {
    this.io = new SocketIOServer()
    this.engine = new BunEngine({
      path: "/socket.io/",
      cors: {
        origin: "*",
      },
    })

    this.io.bind(this.engine)
    this.registerConnectionHandler()
  }

  public static getInstance(): SocketIOService {
    if (!SocketIOService.instance) {
      SocketIOService.instance = new SocketIOService()
    }
    return SocketIOService.instance
  }

  public getBunWebSocketAdapterOptions(): BunWebSocketAdapterOptions {
    return {
      beforeFetch: (request, server, next) => {
        const url = new URL(request.url)
        if (!url.pathname.startsWith("/socket.io/")) {
          return next()
        }

        return this.engine.handleRequest(
          request,
          server as Parameters<BunEngine["handleRequest"]>[1]
        )
      },
      websocket: this.engine.handler().websocket,
    }
  }

  notifyClient(clientId: string, event: RealTimeEvent, data: any): void {
    this.logger.info(`Notifying client ${clientId} with event ${event}`, data)
    this.io.to(clientId).emit(event, data)
  }

  private registerConnectionHandler(): void {
    this.io.on("connection", (socket: Socket) => {
      const clientId = socket.handshake.query.clientId as string
      if (clientId) {
        socket.join(clientId)
        this.logger.info(
          `Client connected: ${socket.id} for clientId: ${clientId}`
        )
      }

      socket.on("disconnect", () => {
        this.logger.info(`Client disconnected: ${socket.id}`)
      })
    })
  }
}
