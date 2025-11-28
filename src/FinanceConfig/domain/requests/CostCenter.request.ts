import { CostCenterCategory } from "../enums/CostCenterCategory.enum"

export type CostCenterRequest = {
  costCenterId: string
  active: boolean
  name: string
  churchId: string
  responsibleMemberId: string
  category: CostCenterCategory
  description?: string
}
