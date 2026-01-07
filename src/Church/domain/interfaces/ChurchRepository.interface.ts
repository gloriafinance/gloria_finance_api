import { IRepository } from "@abejarano/ts-mongodb-criteria"
import { Church } from "@/Church/domain"

export interface IChurchRepository extends IRepository<Church> {
  findById(churchId: string): Promise<Church | undefined>

  listByDistrictId(districtId: string): Promise<Church[]>

  hasAnAssignedMinister(
    churchId: string
  ): Promise<[boolean, Church | undefined]>

  withoutAssignedMinister(): Promise<Church[]>
}
