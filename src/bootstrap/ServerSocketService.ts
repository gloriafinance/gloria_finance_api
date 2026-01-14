// import { Server as SocketIOServer, Socket } from "socket.io"
// import { Server } from "http"
// import { Logger } from "@/Shared/adapter"
// import { IRealTimeEventService, RealTimeEvent } from "@/Shared/domain"
// import { BaseServerService } from "@abejarano/ts-express-server"// export class SocketIOService implements IRealTimeEventService {
//   private static instance: SocketIOService
//   private io: SocketIOServer
//   private logger = Logger(SocketIOService.name)

//   private constructor() {}

//   public static getInstance(): SocketIOService {
//     if (!SocketIOService.instance) {
//       SocketIOService.instance = new SocketIOService()
//     }
//     return SocketIOService.instance
//   }

//   public initialize(httpServer: Server): void {
//     this.io = new SocketIOServer(httpServer, {
//       cors: {
//         origin: "*", // Ajusta esto a tus necesidades de seguridad
//       },
//     })

//     this.io.on("connection", (socket: Socket) => {
//       const clientId = socket.handshake.query.clientId as string
//       if (clientId) {
//         socket.join(clientId)
//         this.logger.info(
//           `Client connected: ${socket.id} for clientId: ${clientId}`
//         )
//       }

//       socket.on("disconnect", () => {
//         this.logger.info(`Client disconnected: ${socket.id}`)
//       })
//     })
//   }

//   notifyClient(clientId: string, event: RealTimeEvent, data: any): void {
//     this.logger.info(`Notifying client ${clientId} with event ${event}`, data)
//     this.io.to(clientId).emit(event, data)
//   }

//   public close(): void {
//     if (this.io) {
//       this.io.close((err) => {
//         if (err) {
//           this.logger.error("Error closing Socket.IO server", err)
//         } else {
//           this.logger.info("Socket.IO server closed.")
//         }
//       })
//     }
//   }
// }

// export class ServerSocketService extends BaseServerService {
//   name = "ServerSocket"
//   priority = -80

//   start(http: Server): Promise<void> | void {
//     SocketIOService.getInstance().initialize(http)
//   }
// }
