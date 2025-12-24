import {
  Criteria,
  MongoRepository,
  Paginate,
} from "@abejarano/ts-mongodb-criteria"
import { IMemberRepository, Member } from "../../domain"

export class MemberMongoRepository
  extends MongoRepository<any>
  implements IMemberRepository
{
  private static instance: MemberMongoRepository

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

  async upsert(member: Member): Promise<void> {
    await this.persist(member.getId(), member)
  }

  list(criteria: Criteria): Promise<Paginate<Member>>
  list(filter: object): Promise<Member[]>

  async list(arg: Criteria | object): Promise<Paginate<Member> | Member[]> {
    if (arg instanceof Criteria) {
      const result = await this.searchByCriteria<Member>(arg)
      return this.paginate<Member>(result)
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

  async one(filter: object): Promise<Member | undefined> {
    const collection = await this.collection()
    const result = await collection.findOne(filter)

    return result
      ? Member.fromPrimitives({
          ...result,
          id: result._id.toString(),
        })
      : undefined
  }

  async all(churchId: string, filter?: object): Promise<Member[]> {
    const collection = await this.collection()

    const result = filter
      ? await collection.find({ churchId, ...filter }).toArray()
      : await collection.find({ churchId }).toArray()

    return result.map((item) =>
      Member.fromPrimitives({
        ...item,
        id: item._id.toString(),
      })
    )
  }
}
