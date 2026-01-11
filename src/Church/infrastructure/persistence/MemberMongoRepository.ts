import {
  Criteria,
  MongoRepository,
  Paginate,
} from "@abejarano/ts-mongodb-criteria"
import { IMemberRepository, Member } from "../../domain"
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

  list(criteria: Criteria): Promise<Paginate<Member>>
  list(filter: object): Promise<Member[]>

  override async list(
    arg: Criteria | object
  ): Promise<Paginate<Member> | Member[]> {
    if (arg instanceof Criteria) {
      return super.list(arg)
    }

    const collection = await this.collection()
    const result = await collection.find(arg).toArray()

    return result.map((item) =>
      Member.fromPrimitives({
        ...item,
        id: item._id.toString(),
      })
    )
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
  }
}
