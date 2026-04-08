import {
  Controller,
  Get,
  Query,
  Req,
  Res,
  type ServerResponse,
} from "bun-platform-kit"
import domainResponse from "@/Shared/helpers/domainResponse.ts"
import type { CashFlowFilters } from "@/Reports/domain"
import type { AuthenticatedRequest } from "@/Shared/infrastructure"
import { CashFlow } from "@/Reports/applications/CashFlow.ts"
import { CashFlowMongoRepository } from "@/Reports/infrastructure/persistence/CashFlowMongoRepository.ts"
import { HttpStatus } from "@/Shared/domain"

@Controller("/api/v1/reports/cash-flow")
export class CashFlowController {
  @Get("/")
  async report(
    @Query() query: CashFlowFilters,
    @Req() req: AuthenticatedRequest,
    @Res()
    res: ServerResponse
  ) {
    try {
      const data = await new CashFlow(
        CashFlowMongoRepository.getInstance()
      ).execute({ ...query, churchId: req.auth.churchId })

      res.status(HttpStatus.OK).send(data)
    } catch (e) {
      domainResponse(e, res)
    }
  }
}
