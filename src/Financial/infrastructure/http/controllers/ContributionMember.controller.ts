import type { ServerResponse } from "bun-platform-kit"
import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  Use,
} from "bun-platform-kit"

import type { AuthenticatedRequest } from "@/Shared/infrastructure"
import {
  Can,
  PermissionMiddleware,
  StorageProviderService,
} from "@/Shared/infrastructure"
import ContributionValidator from "../validators/Contribution.validator"
import { Logger } from "@/Shared/adapter"
import { FindMemberById } from "@/Church/applications"
import { MemberMongoRepository } from "@/Church/infrastructure"
import {
  ListContributions,
  RegisterContributionsOnline,
} from "@/Financial/applications"
import type {
  ContributionRequest,
  FilterContributionsRequest,
} from "@/Financial/domain"
import {
  FinancialConcept,
  MemberContributionType,
  OnlineContributions,
} from "@/Financial/domain"
import { OnlineContributionsMongoRepository } from "@/Financial/infrastructure"
import { FinancialYearMongoRepository } from "@/ConsolidatedFinancial/infrastructure"
import { HttpStatus } from "@/Shared/domain"
import domainResponse from "@/Shared/helpers/domainResponse"
import type { Paginate } from "@abejarano/ts-mongodb-criteria"
import { FinancialConceptMongoRepository } from "@/FinanceConfig/infrastructure/presistence"
import { MemberContributionPaginateDTO } from "@/Financial/infrastructure/http/dto/MemberContributionsDTO.ts"

@Controller("/api/v1/me/contribution")
export class ContributionMemberController {
  private logger = Logger(ContributionMemberController.name)

  @Post("/")
  @Use([
    PermissionMiddleware,
    Can("financial_records", ["add_contributions", "adm_contributions"]),
    ContributionValidator,
  ])
  async createContribution(
    @Body() payload: ContributionRequest,
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    const file = req.files?.file ?? null

    const request = {
      ...payload,
      memberId: req.auth.memberId,
      bankTransferReceipt: file,
    }

    try {
      this.logger.info(`Solicitud de registro de contribucion en línea:`)

      const member = await new FindMemberById(
        MemberMongoRepository.getInstance()
      ).execute({
        memberId: request.memberId,
        churchId: req.auth.churchId,
      })

      let financialConcept: FinancialConcept | undefined
      if (payload.contributionType === MemberContributionType.TITHE) {
        financialConcept =
          (await FinancialConceptMongoRepository.getInstance().one({
            churchId: member.getChurch().churchId,
            tag: "Tithes",
          }))!
      }

      if (payload.contributionType === MemberContributionType.OFFERING) {
        if (!request.financialConceptId) {
          throw new Error(
            "financialConceptId is required for offering contributions"
          )
        }

        financialConcept =
          (await FinancialConceptMongoRepository.getInstance().one({
            financialConceptId: payload.financialConceptId,
          }))!
      }

      await new RegisterContributionsOnline(
        OnlineContributionsMongoRepository.getInstance(),
        StorageProviderService.getInstance(),
        FinancialYearMongoRepository.getInstance()
      ).execute(
        {
          amount: request.amount,
          observation: request.observation,
          paidAt: request.paidAt,
          bankTransferReceipt: request.bankTransferReceipt,
        },
        member,
        financialConcept!
      )

      res.status(HttpStatus.CREATED).send({
        message: "successful contribution registration",
      })
    } catch (e) {
      return domainResponse(e, res)
    }
  }

  @Get("/")
  @Use([
    PermissionMiddleware,
    Can("financial_records", ["list_contributions", "adm_contributions"]),
  ])
  async list(
    @Query() query: FilterContributionsRequest,
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    let filter = {
      ...query,
      churchId: req.auth.churchId,
      memberId: req.auth.memberId,
    }

    try {
      const list: Paginate<OnlineContributions> = await new ListContributions(
        OnlineContributionsMongoRepository.getInstance()
      ).execute(filter)

      res
        .status(HttpStatus.OK)
        .send(
          await MemberContributionPaginateDTO(list, req.auth.symbolFormatMoney)
        )
    } catch (e) {
      domainResponse(e, res)
    }
  }
}
