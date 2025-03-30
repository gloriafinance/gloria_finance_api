import { MongoRepository } from "../../../Shared/infrastructure"
import { IMemberRepository, Member } from "../../domain"
import { Criteria, Paginate } from "../../../Shared/domain"

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

  async list(criteria: Criteria): Promise<Paginate<Member>> {
    const result = await this.searchByCriteria<Member>(criteria)
    return this.buildPaginate<Member>(result)
  }

  async one(memberId: string): Promise<Member | undefined> {
    const collection = await this.collection()
    const result = await collection.findOne({
      memberId,
    })

    return result
      ? Member.fromPrimitives({
          ...result,
          id: result._id.toString(),
        })
      : undefined
  }
}
