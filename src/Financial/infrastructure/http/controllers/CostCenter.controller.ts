import { FinancialConfigurationMongoRepository } from "../../persistence"
import { HttpStatus } from "@/Shared/domain"
import domainResponse from "../../../../Shared/helpers/domainResponse"
import { Response } from "express"
import { CostCenterRequest } from "../../../domain"
import { MemberMongoRepository } from "@/Church/infrastructure"
import { CreateCostCenter } from "../../../applications/costCenter/CreateCostCenter"
import { UpdateCostCenter } from "../../../applications/costCenter/UpdateCostCenter"
import { SearchCostCenterByChurchId } from "../../../applications"

export const FindCostCenterByChurchIdController = async (
  churchId: string,
  res: Response
) => {
  try {
    const costCenter = await new SearchCostCenterByChurchId(
      FinancialConfigurationMongoRepository.getInstance()
    ).execute(churchId)

    res.status(HttpStatus.OK).send(costCenter)
  } catch (e) {
    domainResponse(e, res)
  }
}

export const CreateCostCenterController = async (
  costCenter: CostCenterRequest,
  res: Response
) => {
  try {
    await new CreateCostCenter(
      FinancialConfigurationMongoRepository.getInstance(),
      MemberMongoRepository.getInstance()
    ).execute(costCenter)

    res.status(HttpStatus.CREATED).send({
      message: "Registered cost center",
    })
    return
  } catch (e) {
    domainResponse(e, res)
  }
}

export const UpdateCostCenterController = async (
  costCenter: CostCenterRequest,
  res: Response
) => {
  try {
    await new UpdateCostCenter(
      FinancialConfigurationMongoRepository.getInstance(),
      MemberMongoRepository.getInstance()
    ).execute(costCenter)

    res.status(HttpStatus.CREATED).send({
      message: "Registered cost center",
    })
    return
  } catch (e) {
    domainResponse(e, res)
  }
}
