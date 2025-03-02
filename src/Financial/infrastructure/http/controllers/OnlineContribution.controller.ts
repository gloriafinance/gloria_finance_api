import {
  AvailabilityAccountNotFound,
  ContributionRequest,
  FilterContributionsRequest,
  OnlineContributions,
  OnlineContributionsStatus,
} from "../../../domain"
import { FindMemberById } from "../../../../Church/applications"
import { MemberMongoRepository } from "../../../../Church/infrastructure"
import domainResponse from "../../../../Shared/helpers/domainResponse"
import {
  FindFinancialConceptByChurchIdAndFinancialConceptId,
  ListContributions,
  RegisterContributionsOnline,
  UpdateContributionStatus,
} from "../../../applications"
import { HttpStatus, Paginate } from "../../../../Shared/domain"
import { QueueBullService, StorageGCP } from "../../../../Shared/infrastructure"
import MemberContributionsDTO from "../dto/MemberContributions.dto"
import {
  AvailabilityAccountMongoRepository,
  FinancialConceptMongoRepository,
  OnlineContributionsMongoRepository,
} from "../../persistence"
import { FinancialYearMongoRepository } from "../../../../ConsolidatedFinancial/infrastructure"
import { Logger } from "../../../../Shared/adapter"

export const onlineContributionsController = async (
  request: ContributionRequest,
  res
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
      await AvailabilityAccountMongoRepository.getInstance().findAvailabilityAccountByAvailabilityAccountId(
        request.availabilityAccountId
      )

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
  res
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
  res
) => {
  try {
    await new UpdateContributionStatus(
      OnlineContributionsMongoRepository.getInstance(),
      QueueBullService.getInstance()
    ).execute(contributionId, status)

    res.status(HttpStatus.OK).send({ message: "Contribution updated" })
  } catch (e) {
    domainResponse(e, res)
  }
}
