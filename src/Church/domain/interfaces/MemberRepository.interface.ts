import { Criteria, Paginate } from "@abejarano/ts-mongodb-criteria"
import { Member } from "../Member"

export interface IMemberRepository {
  one(memberId: string): Promise<Member | undefined>

  upsert(member: Member): Promise<void>

  list(criteria: Criteria): Promise<Paginate<Member>>

  all(churchId: string): Promise<Member[]>
}
