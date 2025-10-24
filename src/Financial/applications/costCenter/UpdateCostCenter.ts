import { CostCenter, CostCenterNotFound, CostCenterRequest } from "../../domain"
import { IFinancialConfigurationRepository } from "../../domain/interfaces"
import {
  IMemberRepository,
  Member,
  MemberNotFound,
} from "../../../Church/domain"

export class UpdateCostCenter {
  constructor(
    private readonly financialConfigurationRepository: IFinancialConfigurationRepository,
    private readonly memberRepository: IMemberRepository
  ) {}

  async execute(costCenterRequest: CostCenterRequest) {
    const responsibleMember = await this.findMember(
      costCenterRequest.responsibleMemberId
    )

    const costCenter =
      await this.financialConfigurationRepository.findCostCenterByCostCenterId(
        costCenterRequest.costCenterId,
        costCenterRequest.churchId
      )

    if (!costCenter) {
      throw new CostCenterNotFound()
    }

    costCenter.setUpdateDate(costCenterRequest, responsibleMember)

    await this.financialConfigurationRepository.upsertCostCenter(costCenter)
  }

  private async findMember(responsibleMemberId: string) {
    const member = await this.memberRepository.one({
      memberId: responsibleMemberId,
    })

    if (!member) {
      throw new MemberNotFound()
    }

    return member
  }

  private async create(
    costCenterRequest: CostCenterRequest,
    responsibleMember: Member
  ) {
    const costCenter = CostCenter.create(
      costCenterRequest.costCenterId,
      costCenterRequest.active,
      costCenterRequest.name,
      costCenterRequest.churchId,
      responsibleMember,
      costCenterRequest.category,
      costCenterRequest.description
    )

    await this.financialConfigurationRepository.upsertCostCenter(costCenter)
  }
}
