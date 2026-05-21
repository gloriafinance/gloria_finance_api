import { BaseServerService, type ServerInstance } from "bun-platform-kit"
import { MongoClientFactory } from "@abejarano/ts-mongodb-criteria"

export class MongoDBService extends BaseServerService {
  name: string = "MongoDBService"

  async start(server: ServerInstance): Promise<void> {
    await MongoClientFactory.createClient()
  }

  override async stop(): Promise<void> {
    try {
      await MongoClientFactory.closeClient()

      console.log("MongoDBService connection closed")
    } catch (error) {
      console.error("Error closing MongoDBService connection:", error)
      throw error
    }
  }
}
