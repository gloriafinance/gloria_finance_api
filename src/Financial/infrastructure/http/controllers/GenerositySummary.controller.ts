import { Controller, Get, Query, Req, Res, Use } from "bun-platform-kit"
import type { ServerResponse } from "bun-platform-kit"

import { Logger } from "@/Shared/adapter"
import { FindMemberById } from "@/Church/applications"
import { MemberMongoRepository } from "@/Church/infrastructure"
import { GetMemberGenerositySummary } from "@/Financial/applications"
import { OnlineContributionsMongoRepository } from "@/Financial/infrastructure"
import { AccountsReceivableMongoRepository } from "@/AccountsReceivable/infrastructure/persistence/AccountsReceivableMongoRepository"
import { HttpStatus } from "@/Shared/domain"
import domainResponse from "@/Shared/helpers/domainResponse"
import {
  PermissionMiddleware,
  type AuthenticatedRequest,
} from "@/Shared/infrastructure"

type GenerositySummaryQuery = {
  memberId?: string
}

@Controller("/api/v1/me/generosity-summary")
export class GenerositySummaryController {
  private logger = Logger(GenerositySummaryController.name)

  @Get("/")
  @Use(PermissionMiddleware)
  async getSummary(
    @Query() _query: GenerositySummaryQuery,
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    try {
      const member = await new FindMemberById(
        MemberMongoRepository.getInstance()
      ).execute(req.auth?.memberId)

      const authContext = req.auth as Record<string, any>
      const timeZone =
        authContext?.timezone ||
        authContext?.timeZone ||
        authContext?.churchTimeZone ||
        authContext?.tz ||
        "UTC"

      this.logger.info(`Generating generosity summary`, {
        memberId: member.getMemberId(),
        churchId: authContext?.churchId ?? member.getChurch().churchId,
        timeZone,
      })

      const summary = await new GetMemberGenerositySummary(
        OnlineContributionsMongoRepository.getInstance(),
        AccountsReceivableMongoRepository.getInstance()
      ).execute({
        memberId: member.getMemberId(),
        churchId: authContext?.churchId ?? member.getChurch().churchId,
        debtorDni: member.getDni(),
        timeZone,
      })

      res.status(HttpStatus.OK).json(summary)
    } catch (e) {
      domainResponse(e, res)
    }
  }
}
