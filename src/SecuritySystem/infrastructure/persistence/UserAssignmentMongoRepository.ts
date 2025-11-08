import { MongoRepository } from "@abejarano/ts-mongodb-criteria"
import { DateBR } from "@/Shared/helpers"
import {
  IUserAssignmentRepository,
  UserAssignment,
} from "@/SecuritySystem/domain"

export class UserAssignmentMongoRepository
  extends MongoRepository<UserAssignment>
  implements IUserAssignmentRepository
{
  private static instance: UserAssignmentMongoRepository

  static getInstance(): UserAssignmentMongoRepository {
    if (!UserAssignmentMongoRepository.instance) {
      UserAssignmentMongoRepository.instance =
        new UserAssignmentMongoRepository()
    }

    return UserAssignmentMongoRepository.instance
  }

  collectionName(): string {
    return "user_assignments"
  }

  async assignRoles(
    churchId: string,
    userId: string,
    roles: string[]
  ): Promise<UserAssignment> {
    const collection = await this.collection()
    const updatedAt = DateBR()

    await collection.updateOne(
      { churchId, userId },
      { $set: { churchId, userId, roles, updatedAt } },
      { upsert: true }
    )

    return UserAssignment.create(churchId, userId, roles)
  }

  async findByUser(
    churchId: string,
    userId: string
  ): Promise<UserAssignment | null> {
    const collection = await this.collection()
    const document = await collection.findOne({ churchId, userId })

    if (!document) {
      return null
    }

    return UserAssignment.fromPrimitives({
      ...document,
      id: document._id?.toString(),
    })
  }

  async findUserIdsByRole(churchId: string, roleId: string): Promise<string[]> {
    const collection = await this.collection()
    const documents = await collection
      .find({ churchId, roles: roleId })
      .project({ userId: 1 })
      .toArray()

    return documents.map((document) => document.userId)
  }
}
