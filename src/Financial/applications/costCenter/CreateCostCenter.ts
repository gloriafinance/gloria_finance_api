import { CostCenter, CostCenterExists, CostCenterRequest } from "../../domain"
import { IFinancialConfigurationRepository } from "../../domain/interfaces"
import { IMemberRepository, Member, MemberNotFound } from "@/Church/domain"

import { Logger } from "@/Shared/adapter"

export class CreateCostCenter {
  private logger = Logger("CreateCostCenter")

  constructor(
    private readonly financialConfigurationRepository: IFinancialConfigurationRepository,
    private readonly memberRepository: IMemberRepository
  ) {}

  async execute(costCenterRequest: CostCenterRequest) {
    this.logger.info(`Creating cost center `, costCenterRequest)
    const responsibleMember = await this.findMember(
      costCenterRequest.responsibleMemberId
    )

    const costCenter =
      await this.financialConfigurationRepository.findCostCenterByCostCenterId(
        costCenterRequest.costCenterId,
        costCenterRequest.churchId
      )

    if (costCenter) {
      throw new CostCenterExists()
    }

    await this.create(costCenterRequest, responsibleMember)
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
