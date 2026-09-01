import { MongoRepository } from "@abejarano/ts-mongodb-criteria"
import { type IMemberRepository, Member } from "../../domain"
import { Collection } from "mongodb"

export class MemberMongoRepository
  extends MongoRepository<Member>
  implements IMemberRepository
{
  private static instance: MemberMongoRepository

  private constructor() {
    super(Member)
  }

  public static getInstance(): MemberMongoRepository {
    if (MemberMongoRepository.instance) {
      return MemberMongoRepository.instance
    }
    MemberMongoRepository.instance = new MemberMongoRepository()
    return MemberMongoRepository.instance
  }

  collectionName(): string {
    return "members"
  }

  async deleteByMemberId(memberId: string): Promise<void> {
    const collection = await this.collection()
    await collection.deleteOne({ memberId })
  }

  async all(churchId: string, filter?: object): Promise<Member[]> {
    const collection = await this.collection()

    const result = filter
      ? await collection
          .find({ "church.churchId": churchId, ...filter })
          .toArray()
      : await collection.find({ "church.churchId": churchId }).toArray()

    return result.map((item) =>
      Member.fromPrimitives({
        ...item,
        id: item._id.toString(),
      })
    )
  }

  protected async ensureIndexes(collection: Collection): Promise<void> {
    await collection.createIndex({ "church.churchId": 1 })
    await collection.createIndex({ memberId: 1 })
    await collection.createIndex({ dni: 1 }, { unique: true })
    await collection.createIndex(
      { "church.churchId": 1, status: 1, createdAt: -1 },
      { name: "idx_members_church_status_created", background: true }
    )
  }
}
