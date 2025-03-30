import { Response } from "express"
import { FilterFinanceRecordRequest } from "../../../domain"
import { SearchFinanceRecord } from "../../../applications"
import { FinanceRecordMongoRepository } from "../../persistence"
import domainResponse from "@/Shared/helpers/domainResponse"
import { HttpStatus } from "@/Shared/domain"
import FinanceRecordPaginateDTO from "../dto/FinanceRecordPaginate.dto"
import { Logger } from "@/Shared/adapter"

export const FinanceRecordListController = async (
  filter: FilterFinanceRecordRequest,
  res: Response
) => {
  const logger = Logger("FinanceRecordListController")

  try {
    logger.info(`Filtering financial records with: ${JSON.stringify(filter)}`)
    const list = await new SearchFinanceRecord(
      FinanceRecordMongoRepository.getInstance()
    ).execute(filter)

    res.status(HttpStatus.OK).send(await FinanceRecordPaginateDTO(list))
  } catch (e) {
    return domainResponse(e, res)
  }
}
