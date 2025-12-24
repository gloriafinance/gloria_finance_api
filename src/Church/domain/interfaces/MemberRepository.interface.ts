import { Criteria, Paginate } from "@abejarano/ts-mongodb-criteria"
import { Member } from "../Member"

export interface IMemberRepository {
  one(filter: object): Promise<Member | undefined>

  upsert(member: Member): Promise<void>

  list(criteria: Criteria): Promise<Paginate<Member>>

  list(filter: object): Promise<Member[]>

  all(churchId: string, filter?: object): Promise<Member[]>
}
