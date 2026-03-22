import {
  type FilterFinancialConceptRequest,
  type FinancialConceptRequest,
} from "@/Financial/domain"
import domainResponse from "@/Shared/helpers/domainResponse"
import { ChurchMongoRepository } from "@/Church/infrastructure"
import { HttpStatus } from "@/Shared/domain"
import {
  CreateOrUpdateFinancialConcept,
  FindFinancialConceptsByChurchIdAndTypeConcept,
} from "@/FinanceConfig/applications"
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  type ServerResponse,
  Use,
} from "bun-platform-kit"
import { FinancialConceptMongoRepository } from "@/FinanceConfig/infrastructure/presistence"
import { Can, PermissionMiddleware } from "@/Shared/infrastructure"

@Controller("/api/v1/finance/configuration/financial-concepts")
export class FinancialConceptController {
  @Post("/")
  @Use([
    PermissionMiddleware,
    Can("financial_configuration", "manage_concepts"),
  ])
  async createOrUpdateFinancialConcept(
    @Body() req: FinancialConceptRequest,
    @Res() res: ServerResponse
  ) {
    try {
      await new CreateOrUpdateFinancialConcept(
        FinancialConceptMongoRepository.getInstance(),
        ChurchMongoRepository.getInstance()
      ).execute(req)

      res.status(HttpStatus.CREATED).send({
        message: "Financial concept created or updated successfully",
      })
    } catch (error) {
      domainResponse(error, res)
    }
  }

  @Get("/:churchId")
  @Use([
    PermissionMiddleware,
    Can("financial_configuration", ["manage_concepts", "list_concepts"]),
  ])
  async findFinancialConceptsByChurchId(
    @Param("churchId") churchId: string,
    @Query() query: FilterFinancialConceptRequest,
    @Res() res: ServerResponse
  ) {
    try {
      const financial = await new FindFinancialConceptsByChurchIdAndTypeConcept(
        FinancialConceptMongoRepository.getInstance(),
        ChurchMongoRepository.getInstance()
      ).execute(churchId, query.type, query.statementCategory)

      res.status(HttpStatus.OK).send(financial)
    } catch (error) {
      domainResponse(error, res)
    }
  }
}
