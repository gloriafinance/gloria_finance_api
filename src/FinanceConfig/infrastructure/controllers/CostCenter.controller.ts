import { HttpStatus } from "@/Shared/domain"
import domainResponse from "../../../Shared/helpers/domainResponse"
import { Response } from "express"
import { MemberMongoRepository } from "@/Church/infrastructure"
import { CreateCostCenter } from "@/FinanceConfig/applications/costCenter/CreateCostCenter"
import { UpdateCostCenter } from "@/Financial/applications/UpdateCostCenter"
import { SearchCostCenterByChurchId } from "@/FinanceConfig/applications"
import { FinancialConfigurationMongoRepository } from "@/FinanceConfig/infrastructure/presistence"
import { CostCenterRequest } from "@/FinanceConfig/domain"
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Res,
  Use,
} from "@abejarano/ts-express-server"
import { Can, PermissionMiddleware } from "@/Shared/infrastructure"

@Controller("/api/v1/finance/configuration/cost-center")
export class CostCenterController {
  @Get("/:churchId")
  @Use([PermissionMiddleware, Can("financial_configuration", "cost_centers")])
  async FindCostCenterByChurchIdController(
    @Param("churchId") churchId: string,
    @Res() res: Response
  ) {
    try {
      const costCenter = await new SearchCostCenterByChurchId(
        FinancialConfigurationMongoRepository.getInstance()
      ).execute(churchId)

      res.status(HttpStatus.OK).send(costCenter)
    } catch (e) {
      domainResponse(e, res)
    }
  }

  @Post("/")
  @Use([PermissionMiddleware, Can("financial_configuration", "cost_centers")])
  async CreateCostCenterController(
    @Body() costCenter: CostCenterRequest,
    @Res() res: Response
  ) {
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

  @Put("/")
  @Use([PermissionMiddleware, Can("financial_configuration", "cost_centers")])
  async UpdateCostCenterController(
    @Body() costCenter: CostCenterRequest,
    @Res() res: Response
  ) {
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
}
