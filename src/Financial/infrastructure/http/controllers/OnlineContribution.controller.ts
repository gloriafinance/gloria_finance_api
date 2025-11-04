import {
  AvailabilityAccountNotFound,
  ContributionRequest,
  FilterContributionsRequest,
  OnlineContributions,
  OnlineContributionsStatus,
} from "../../../domain"
import { FindMemberById } from "@/Church/applications"
import { MemberMongoRepository } from "@/Church/infrastructure"
import domainResponse from "@/Shared/helpers/domainResponse"
import {
  FindFinancialConceptByChurchIdAndFinancialConceptId,
  ListContributions,
  RegisterContributionsOnline,
  UpdateContributionStatus,
} from "../../../applications"
import { HttpStatus } from "@/Shared/domain"
import { QueueService, StorageGCP } from "@/Shared/infrastructure"
import MemberContributionsDTO from "../dto/MemberContributions.dto"
import {
  AvailabilityAccountMongoRepository,
  FinancialConceptMongoRepository,
  OnlineContributionsMongoRepository,
} from "../../persistence"
import { FinancialYearMongoRepository } from "@/ConsolidatedFinancial/infrastructure"
import { Logger } from "@/Shared/adapter"
import { Response } from "express"
import { Paginate } from "@abejarano/ts-mongodb-criteria"

export const onlineContributionsController = async (
  request: ContributionRequest,
  res: Response
) => {
  try {
    const logger = Logger("OnlineContributionsController")

    logger.info(`Solicitud de registro de contribucion en línea:`)

    const member = await new FindMemberById(
      MemberMongoRepository.getInstance()
    ).execute(request.memberId)

    const financialConcept =
      await new FindFinancialConceptByChurchIdAndFinancialConceptId(
        FinancialConceptMongoRepository.getInstance()
      ).execute(member.getChurchId(), request.financialConceptId)

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
    ).execute(request, availabilityAccount, member, financialConcept)

    res.status(HttpStatus.CREATED).send({
      message: "successful contribution registration",
    })
  } catch (e) {
    return domainResponse(e, res)
  }
}

export const listOnlineContributionsController = async (
  request: FilterContributionsRequest,
  res: Response
) => {
  const logger = Logger("listOnlineContributionsController")
  logger.info(`Filtering online contributions with: `, request)

  try {
    const list: Paginate<OnlineContributions> = await new ListContributions(
      OnlineContributionsMongoRepository.getInstance()
    ).execute(request)

    res.status(HttpStatus.OK).send(await MemberContributionsDTO(list))
  } catch (e) {
    domainResponse(e, res)
  }
}

export const UpdateContributionStatusController = async (
  contributionId: string,
  status: OnlineContributionsStatus,
  createdBy: string,
  res: Response
) => {
  try {
    await new UpdateContributionStatus(
      OnlineContributionsMongoRepository.getInstance(),
      QueueService.getInstance()
    ).execute(contributionId, status, createdBy)

    res.status(HttpStatus.OK).send({ message: "Contribution updated" })
  } catch (e) {
    domainResponse(e, res)
  }
}
