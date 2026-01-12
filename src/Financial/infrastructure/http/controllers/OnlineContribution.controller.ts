import {
  FilterContributionsRequest,
  OnlineContributions,
  OnlineContributionsStatus,
} from "../../../domain"
import domainResponse from "@/Shared/helpers/domainResponse"
import {
  ListContributions,
  UpdateContributionStatus,
} from "../../../applications"
import { HttpStatus } from "@/Shared/domain"
import {
  AuthenticatedRequest,
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
import { FinanceRecordMongoRepository } from "@/Financial/infrastructure/persistence/FinanceRecordMongoRepository"
import { Logger } from "@/Shared/adapter"
import { Response } from "express"
import { Paginate } from "@abejarano/ts-mongodb-criteria"
import {
  Controller,
  Get,
  Query,
  Req,
  Res,
  Use,
  Param,
  Patch,
} from "@abejarano/ts-express-server"

@Controller("/api/v1/finance/contributions")
export class ContribuitionController {
  @Get("/")
  @Use([
    PermissionMiddleware,
    Can("financial_records", ["list_contributions", "adm_contributions"]),
  ])
  async listOnlineContributionsController(
    @Query() filter: FilterContributionsRequest,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response
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

      res.status(HttpStatus.OK).send(await MemberContributionsDTO(list))
    } catch (e) {
      domainResponse(e, res)
    }
  }

  @Patch("/:contributionId/status/:status")
  async updateContributionStatusController(
    @Param()
    params: { contributionId: string; status: OnlineContributionsStatus },
    @Req() req: AuthenticatedRequest,
    @Res() res: Response
  ) {
    try {
      await new UpdateContributionStatus(
        OnlineContributionsMongoRepository.getInstance(),
        QueueService.getInstance(),
        FinanceRecordMongoRepository.getInstance(),
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
