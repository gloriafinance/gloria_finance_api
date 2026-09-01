import { type IRepository } from "@abejarano/ts-mongodb-criteria"
import { Member } from "../Member"

export interface IMemberRepository extends IRepository<Member> {
  //upsert(member: Member): Promise<void>

  deleteByMemberId(memberId: string): Promise<void>

  // list(criteria: Criteria): Promise<Paginate<Member>>
  //
  // list(filter: object): Promise<Member[]>

  all(churchId: string, filter?: object): Promise<Member[]>
}
