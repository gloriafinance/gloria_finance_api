import { ChurchBankingClient } from "@/Banking/infrastructure/church-banking/ChurchBankingClient"
import { ChurchMongoRepository } from "@/Church/infrastructure"
import {
  CreateOrUpdateFinancialConcept,
  CreateStaticPixForConcept,
  FindFinancialConceptsByChurchIdAndTypeConcept,
} from "@/FinanceConfig/applications"
import { FinancialConceptMongoRepository } from "@/FinanceConfig/infrastructure/presistence"
import {
  type FilterFinancialConceptRequest,
  type FinancialConceptRequest,
} from "@/Financial/domain"
import { HttpStatus } from "@/Shared/domain"
import domainResponse from "@/Shared/helpers/domainResponse"
import {
  type AuthenticatedRequest,
  Can,
  PermissionMiddleware,
} from "@/Shared/infrastructure"
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  type ServerResponse,
  Use,
} from "bun-platform-kit"

@Controller("/api/v1/finance/configuration/financial-concepts")
export class FinancialConceptController {
  @Post("/create-static-pix")
  @Use([
    PermissionMiddleware,
    Can("financial_configuration", "manage_concepts"),
  ])
  async createStaticPix(
    @Body() body: { financialConceptId: string },
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    try {
      const response = await new CreateStaticPixForConcept(
        new ChurchBankingClient(),
        FinancialConceptMongoRepository.getInstance()
      ).execute({
        churchId: req.auth.churchId,
        financialConceptId: body.financialConceptId,
      })

      res.status(HttpStatus.CREATED).send(response)
    } catch (error) {
      domainResponse(error, res)
    }
  }

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
