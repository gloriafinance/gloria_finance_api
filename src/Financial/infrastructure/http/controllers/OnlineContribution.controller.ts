import type {
  ContributionChangeStatusRequest,
  FilterContributionsRequest,
} from "../../../domain"
import { OnlineContributions } from "../../../domain"
import domainResponse from "@/Shared/helpers/domainResponse"
import {
  ListContributions,
  UpdateContributionStatus,
} from "../../../applications"
import { HttpStatus } from "@/Shared/domain"
import type { AuthenticatedRequest } from "@/Shared/infrastructure"
import {
  Can,
  PermissionMiddleware,
  QueueService,
} from "@/Shared/infrastructure"
import MemberContributionsDTO from "../dto/MemberContributions.dto"
import {
  AvailabilityAccountMongoRepository,
  OnlineContributionsMongoRepository,
} from "../../persistence"
import { AccountsReceivableMongoRepository } from "@/AccountsReceivable/infrastructure/persistence/AccountsReceivableMongoRepository"
import { Logger } from "@/Shared/adapter"
import { type Paginate } from "@abejarano/ts-mongodb-criteria"
import {
  Body,
  Controller,
  Get,
  Patch,
  Query,
  Req,
  Res,
  type ServerResponse,
  Use,
} from "bun-platform-kit"
import { FinancialConceptMongoRepository } from "@/FinanceConfig/infrastructure/presistence"

@Controller("/api/v1/finance/contributions")
export class ContributionController {
  @Get("/")
  @Use([
    PermissionMiddleware,
    Can("financial_records", ["list_contributions", "adm_contributions"]),
  ])
  async listOnlineContributionsController(
    @Query() filter: FilterContributionsRequest,
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    const logger = Logger("listOnlineContributionsController")
    logger.info(`Filtering online contributions with: `, filter)

    if (req.auth.isSuperuser && filter.churchId === undefined) {
      delete filter.churchId
    } else {
      filter.churchId = req.auth.churchId
    }

    try {
      const list: Paginate<OnlineContributions> = await new ListContributions(
        OnlineContributionsMongoRepository.getInstance()
      ).execute(filter)

      res
        .status(HttpStatus.OK)
        .send(await MemberContributionsDTO(list, req.auth.symbolFormatMoney))
    } catch (e) {
      domainResponse(e, res)
    }
  }

  @Patch("/")
  @Use([PermissionMiddleware, Can("financial_records", "adm_contributions")])
  async updateContributionStatusController(
    @Body()
    params: ContributionChangeStatusRequest,
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    try {
      await new UpdateContributionStatus(
        FinancialConceptMongoRepository.getInstance(),
        OnlineContributionsMongoRepository.getInstance(),
        QueueService.getInstance(),
        AvailabilityAccountMongoRepository.getInstance(),
        AccountsReceivableMongoRepository.getInstance()
      ).execute({
        ...params,
        createdBy: req.auth.name,
        symbol: req.auth.symbolFormatMoney,
      })

      res.status(HttpStatus.OK).send({ message: "Contribution updated" })
    } catch (e) {
      domainResponse(e, res)
    }
  }
}
