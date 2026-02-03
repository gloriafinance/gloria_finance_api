import { DREMaster } from "@/Reports/domain/DREMaster"
import type { IRepository } from "@abejarano/ts-mongodb-criteria"

export interface IDRERepository extends IRepository<DREMaster> {}
