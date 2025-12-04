import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  Use,
} from "@abejarano/ts-express-server"
import { Can, PermissionMiddleware, StorageGCP } from "@/Shared/infrastructure"
import { Request, Response } from "express"
import ContributionValidator from "../validators/Contribution.validator"
import { Logger } from "@/Shared/adapter"
import { FindMemberById } from "@/Church/applications"
import { MemberMongoRepository } from "@/Church/infrastructure"
import {
  ListContributions,
  RegisterContributionsOnline,
} from "@/Financial/applications"
import { AvailabilityAccountMongoRepository } from "@/Financial/infrastructure/persistence"
import {
  AvailabilityAccountNotFound,
  ContributionRequest,
  FilterContributionsRequest,
  FinancialConcept,
  MemberContributionType,
  OnlineContributions,
} from "@/Financial/domain"
import { OnlineContributionsMongoRepository } from "@/Financial/infrastructure"
import { FinancialYearMongoRepository } from "@/ConsolidatedFinancial/infrastructure"
import { HttpStatus } from "@/Shared/domain"
import domainResponse from "@/Shared/helpers/domainResponse"
import { Paginate } from "@abejarano/ts-mongodb-criteria"
import MemberContributionsDTO from "@/Financial/infrastructure/http/dto/MemberContributions.dto"
import { FinancialConceptMongoRepository } from "@/FinanceConfig/infrastructure/presistence"

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
    @Req() req: Request,
    @Res() res: Response
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
      ).execute(request.memberId)

      let financialConcept: FinancialConcept | undefined
      if (payload.contributionType === MemberContributionType.TITHE) {
        financialConcept =
          await FinancialConceptMongoRepository.getInstance().one({
            churchId: member.getChurchId(),
            name: "Dízimos de Membros",
          })
      }

      if (payload.contributionType === MemberContributionType.OFFERING) {
        if (!request.financialConceptId) {
          throw new Error(
            "financialConceptId is required for offering contributions"
          )
        }

        financialConcept =
          await FinancialConceptMongoRepository.getInstance().one({
            financialConceptId: payload.financialConceptId,
          })
      }

      const availabilityAccount =
        await AvailabilityAccountMongoRepository.getInstance().one({
          availabilityAccountId: request.availabilityAccountId,
        })

      if (!availabilityAccount) {
        throw new AvailabilityAccountNotFound()
      }

      await new RegisterContributionsOnline(
        OnlineContributionsMongoRepository.getInstance(),
        StorageGCP.getInstance(process.env.BUCKET_FILES),
        FinancialYearMongoRepository.getInstance()
      ).execute(
        {
          amount: request.amount,
          observation: request.observation,
          paidAt: request.paidAt,
          bankTransferReceipt: request.bankTransferReceipt,
        },
        availabilityAccount,
        member,
        financialConcept
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
    @Req() req: Request,
    @Res() res: Response
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

      res.status(HttpStatus.OK).send(await MemberContributionsDTO(list))
    } catch (e) {
      domainResponse(e, res)
    }
  }
}
