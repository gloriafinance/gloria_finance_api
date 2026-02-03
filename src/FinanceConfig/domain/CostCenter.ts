import { DateBR } from "@/Shared/helpers"
import { Member } from "@/Church/domain"
import { CostCenterCategory } from "./enums/CostCenterCategory.enum"
import { type CostCenterRequest } from "./requests/CostCenter.request"

export class CostCenter {
  private costCenterId: string
  private active: boolean
  private name: string
  private description?: string
  private responsible: {
    memberId: string
    name: string
    email: string
    phone: string
  }
  private churchId: string
  private category: CostCenterCategory
  private createdAt: Date

  static create(
    costCenterId: string,
    active: boolean,
    name: string,
    churchId: string,
    responsibleMember: Member,
    category: CostCenterCategory,
    description?: string
  ): CostCenter {
    const costCenter: CostCenter = new CostCenter()
    costCenter.costCenterId = costCenterId
    costCenter.active = active
    costCenter.name = name
    costCenter.churchId = churchId
    costCenter.description = description
    costCenter.createdAt = DateBR()
    costCenter.responsible = {
      memberId: responsibleMember.getMemberId(),
      name: responsibleMember.getName(),
      email: responsibleMember.getEmail(),
      phone: responsibleMember.getPhone(),
    }
    costCenter.category = category

    return costCenter
  }

  static fromPrimitives(plainData: any): CostCenter {
    const costCenter: CostCenter = new CostCenter()

    costCenter.active = plainData.active
    costCenter.costCenterId = plainData.costCenterId
    costCenter.name = plainData.name
    costCenter.churchId = plainData.churchId
    costCenter.createdAt = plainData.createdAt
    costCenter.description = plainData.description
    costCenter.responsible = plainData.responsible
    costCenter.category = plainData.category

    return costCenter
  }

  getCostCenterId() {
    return this.costCenterId
  }

  getCostCenterName() {
    return this.name
  }

  getChurchId(): string {
    return this.churchId
  }

  getCategory(): CostCenterCategory {
    return this.category
  }

  setUpdateDate(request: CostCenterRequest, responsibleMember: Member) {
    this.active = request.active
    this.name = request.name
    this.description = request.description
    this.responsible = {
      memberId: responsibleMember.getMemberId(),
      name: responsibleMember.getName(),
      email: responsibleMember.getEmail(),
      phone: responsibleMember.getPhone(),
    }
    this.category = request.category
  }

  toPrimitives(): any {
    return {
      category: this.category,
      responsible: this.responsible,
      active: this.active,
      costCenterId: this.costCenterId,
      name: this.name,
      description: this.description,
      churchId: this.churchId,
      createdAt: this.createdAt,
    }
  }
}
