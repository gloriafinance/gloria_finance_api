import { IUserRepository, User } from "../../domain"
import { ObjectId } from "mongodb"
import { IRepository, MongoRepository } from "@abejarano/ts-mongodb-criteria"

interface Repository extends IUserRepository, IRepository<User> {}

export class UserMongoRepository
  extends MongoRepository<User>
  implements Repository
{
  private static instance: UserMongoRepository

  constructor() {
    super(User)
  }

  static getInstance(): UserMongoRepository {
    if (!UserMongoRepository.instance) {
      UserMongoRepository.instance = new UserMongoRepository()
    }
    return UserMongoRepository.instance
  }

  collectionName(): string {
    return "bk_users"
  }

  async findByEmail(email: string): Promise<User | undefined> {
    const collection = await this.collection()
    const result = await collection.findOne({ email })
    if (!result) return undefined

    return User.fromPrimitives({ ...result, id: result._id.toString() })
  }

  async findByUserId(userId: string): Promise<User | undefined> {
    const collection = await this.collection()
    const result = await collection.findOne({ userId })
    if (!result) return undefined

    return User.fromPrimitives({ ...result, id: result._id.toString() })
  }

  async updatePassword(user: User): Promise<void> {
    const collection = await this.collection()

    await collection.updateOne(
      { _id: new ObjectId(user.getId()) },
      {
        $set: {
          password: user.getPassword(),
        },
      }
    )
  }
}
