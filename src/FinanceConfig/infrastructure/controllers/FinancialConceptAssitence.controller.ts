import {
  Body,
  Controller,
  Post,
  Req,
  Res,
  type ServerResponse,
  Use,
} from "bun-platform-kit"
import {
  type AuthenticatedRequest,
  Can,
  PermissionMiddleware,
} from "@/Shared/infrastructure"
import { FinancialConceptMongoRepository } from "@/FinanceConfig/infrastructure/presistence"
import { FinancialConceptAgent } from "@/FinanceConfig/infrastructure/agents/FinancialConcept.agent.ts"
import { HttpStatus } from "@/Shared/domain"
import domainResponse from "@/Shared/helpers/domainResponse.ts"

@Controller("/api/v1/ai/assistance/financial-concepts")
export class IAAssistanceFinancialConceptController {
  @Post("/")
  @Use([
    PermissionMiddleware,
    Can("financial_configuration", "manage_concepts"),
  ])
  async getFinancialConcepts(
    @Body() body: { context: string },
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    try {
      const concepts =
        await FinancialConceptMongoRepository.getInstance().search({
          churchId: req.auth.churchId,
        })

      const response = await new FinancialConceptAgent().execute({
        concepts,
        context: body.context,
        lang: req.auth.lang,
      })

      res.status(HttpStatus.OK).send(response)
    } catch (error) {
      domainResponse(error, res)
    }
  }
}
