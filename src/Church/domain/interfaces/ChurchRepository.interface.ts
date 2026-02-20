import { type IRepository } from "@abejarano/ts-mongodb-criteria"
import { Church } from "@/Church/domain"

export interface IChurchRepository extends IRepository<Church> {
  all(filter: object): Promise<Church[]>

  listByDistrictId(districtId: string): Promise<Church[]>

  hasAnAssignedMinister(
    churchId: string
  ): Promise<[boolean, Church | undefined]>

  withoutAssignedMinister(): Promise<Church[]>
}
