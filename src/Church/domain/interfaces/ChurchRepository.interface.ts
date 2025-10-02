import { Criteria, Paginate } from "@abejarano/ts-mongodb-criteria"
import { Church, ChurchDTO } from "@/Church/domain"

export interface IChurchRepository {
  one(churchId: string): Promise<Church | undefined>

  upsert(church: Church): Promise<void>

  list(criteria: Criteria): Promise<Paginate<ChurchDTO>>

  listByDistrictId(districtId: string): Promise<Church[]>

  hasAnAssignedMinister(
    churchId: string
  ): Promise<[boolean, Church | undefined]>

  withoutAssignedMinister(): Promise<Church[]>
}
