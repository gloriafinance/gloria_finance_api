import { Minister } from "../Minister"
import { IRepository } from "@abejarano/ts-mongodb-criteria"

export interface IMinisterRepository extends IRepository<Minister> {
  findById(ministerId: string): Promise<Minister | undefined>

  findByDni(dni: string): Promise<Minister | undefined>

  withoutAssignedChurch(): Promise<Minister[]>

  hasAnAssignedChurch(ministerId: string): Promise<[boolean, Minister]>
}
